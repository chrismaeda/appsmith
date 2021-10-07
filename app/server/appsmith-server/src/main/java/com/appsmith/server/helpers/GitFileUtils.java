package com.appsmith.server.helpers;

import com.appsmith.external.git.FileInterface;
import com.appsmith.external.git.GitExecutor;
import com.appsmith.external.helpers.BeanCopyUtils;
import com.appsmith.external.models.ApplicationGitReference;
import com.appsmith.git.helpers.FileUtilsImpl;
import com.appsmith.server.domains.Application;
import com.appsmith.server.domains.ApplicationJson;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.eclipse.jgit.api.errors.GitAPIException;
import org.springframework.context.annotation.Import;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;

import java.io.IOException;
import java.lang.reflect.Field;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Slf4j
@RequiredArgsConstructor
@Component
@Import({FileUtilsImpl.class})
public class GitFileUtils {

    private final FileInterface fileUtils;
    private final GitExecutor gitExecutor;

    // Only include the application helper fields in metadata object
    private static final Set<String> blockedMetadataFields
        = Set.of("exportedApplication", "datasourceList", "pageList", "actionList", "decryptedFields");

    /**
     * This method will save the complete application in the local repo directory.
     * Path to repo will be : ./container-volumes/git-repo/organizationId/defaultApplicationId/branchName/{application_data}
     * @param baseRepoSuffix path suffix used to create a branch repo path as per worktree implementation
     * @param applicationJson application reference object from which entire application can be rehydrated
     * @param branchName name of the branch for the current application
     * @return repo path where the application is stored
     */
    public Mono<Path> saveApplicationToLocalRepo(Path baseRepoSuffix,
                                                 ApplicationJson applicationJson,
                                                 String branchName) throws IOException, GitAPIException {

        /*
            1. Checkout to branch
            2. Create application reference for appsmith-git module
            3. Save application to git repo
         */
        ApplicationGitReference applicationReference = new ApplicationGitReference();
        gitExecutor.checkoutToBranch(baseRepoSuffix, branchName);
        // Pass application reference
        applicationReference.setApplication(applicationJson.getExportedApplication());

        // Pass metadata
        Iterable<String> keys = Arrays.stream(applicationJson.getClass().getDeclaredFields())
            .map(Field::getName)
            .filter(name -> !blockedMetadataFields.contains(name))
            .collect(Collectors.toList());

        ApplicationJson applicationMetadata = new ApplicationJson();

        BeanCopyUtils.copyProperties(applicationJson, applicationMetadata, keys);
        applicationReference.setMetadata(applicationMetadata);

        // Pass pages within the application
        Map<String, Object> resourceMap = new HashMap<>();
        applicationJson.getPageList().forEach(newPage -> {
            String pageName = "";
            if (newPage.getUnpublishedPage() != null) {
                pageName = newPage.getUnpublishedPage().getName();
            } else if (newPage.getPublishedPage() != null) {
                pageName = newPage.getPublishedPage().getName();
            }
            // pageName will be used for naming the json file
            resourceMap.put(pageName, newPage);
        });
        applicationReference.setPages(new HashMap<>(resourceMap));
        resourceMap.clear();

        // Send actions
        applicationJson.getActionList().forEach(newAction -> {
            String prefix = newAction.getUnpublishedAction() != null ?
                newAction.getUnpublishedAction().getName() + "_" + newAction.getUnpublishedAction().getPageId()
                : newAction.getPublishedAction().getName() + "_" + newAction.getPublishedAction().getPageId();
            resourceMap.put(prefix, newAction);
        });
        applicationReference.setActions(new HashMap<>(resourceMap));
        resourceMap.clear();

        // Send jsActionCollections
        applicationJson.getActionCollectionList().forEach(actionCollection -> {
            String prefix = actionCollection.getUnpublishedCollection() != null ?
                    actionCollection.getUnpublishedCollection().getName() + "_" + actionCollection.getUnpublishedCollection().getPageId()
                    : actionCollection.getPublishedCollection().getName() + "_" + actionCollection.getPublishedCollection().getPageId();
            resourceMap.put(prefix, actionCollection);
        });
        applicationReference.setActionsCollections(new HashMap<>(resourceMap));
        resourceMap.clear();

        // Send datasources
        applicationJson.getDatasourceList().forEach(
            datasource -> resourceMap.put(datasource.getName(), datasource)
        );
        applicationReference.setDatasources(new HashMap<>(resourceMap));
        resourceMap.clear();


        // Save application to git repo
        return fileUtils.saveApplicationToGitRepo(baseRepoSuffix, applicationReference, branchName);
    }

    /**
     * This will reconstruct the application from the repo
     * @param organisationId To which organisation application needs to be rehydrated
     * @param defaultApplicationId To which organisation application needs to be rehydrated
     * @param branchName for which the application needs to be rehydrate
     * @return application reference from which entire application can be rehydrated
     */
    public ApplicationJson reconstructApplicationFromGitRepo(String organisationId,
                                                             String defaultApplicationId,
                                                             String repoName,
                                                             String branchName) throws GitAPIException, IOException {

        ApplicationJson applicationJson = new ApplicationJson();

        ApplicationGitReference applicationReference =
            fileUtils.reconstructApplicationFromGitRepo(organisationId, defaultApplicationId, repoName, branchName);

        // TODO test this during rehydration
        // Extract application data from the json
        applicationJson.setExportedApplication((Application) applicationReference.getApplication());

        // Extract application metadata from the json
        BeanCopyUtils.copyNestedNonNullProperties(applicationReference.getMetadata(), applicationJson);

        // Extract actions
        applicationJson.setActionList(getApplicationResource(applicationReference.getActions()));

        // Extract pages
        applicationJson.setPageList(getApplicationResource(applicationReference.getPages()));

        // Extract datasources
        applicationJson.setDatasourceList(getApplicationResource(applicationReference.getDatasources()));

        return applicationJson;
    }

    private <T> List<T> getApplicationResource(Map<String, Object> resources) {

        List<T> deserializedResources = new ArrayList<>();
        for (Map.Entry<String, Object> resource : resources.entrySet()) {
            deserializedResources.add((T) resource.getValue());
        }
        return deserializedResources;
    }

    /**
     * Once the user connects the existing application to a remote repo, we will initialize the repo with Readme.md -
     * Url to the deployed app(view and edit mode)
     * Link to discord channel for support
     * Link to appsmith documentation for Git related operations
     * Welcome message
     *
     * @param baseRepoSuffix path suffix used to create a branch repo path as per worktree implementation
     * @param viewModeUrl    URL to deployed version of the application view only mode
     * @param editModeUrl    URL to deployed version of the application edit mode
     * @return Path where the Application is stored
     */
    public Mono<Path> initializeGitRepo(Path baseRepoSuffix,
                                        String viewModeUrl,
                                        String editModeUrl) throws IOException {
        return fileUtils.initializeGitRepo(baseRepoSuffix,viewModeUrl, editModeUrl);
    }

    /**
     * When the user clicks on detach remote, we need to remove the repo from the file system
     * @param baseRepoSuffix path suffix used to create a branch repo path as per worktree implementation
     * @return success on remove of file system
     */
    public Mono<Boolean> detachRemote(Path baseRepoSuffix) {
        return fileUtils.detachRemote(baseRepoSuffix);
    }

    public Mono<Boolean> checkIfDirectoryIsEmpty(Path baseRepoSuffix) throws IOException { return fileUtils.checkIfDirectoryIsEmpty(baseRepoSuffix); };
}
