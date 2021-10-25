package com.appsmith.server.solutions;

import com.appsmith.server.domains.ActionCollection;
import com.appsmith.server.domains.Application;
import com.appsmith.server.domains.CommentThread;
import com.appsmith.server.domains.DefaultResources;
import com.appsmith.server.domains.NewAction;
import com.appsmith.server.domains.NewPage;
import com.appsmith.server.dtos.ActionCollectionDTO;
import com.appsmith.server.dtos.ActionDTO;
import com.appsmith.server.dtos.ActionViewDTO;
import com.appsmith.server.dtos.ApplicationPagesDTO;
import com.appsmith.server.dtos.LayoutDTO;
import com.appsmith.server.dtos.PageDTO;
import com.appsmith.server.dtos.PageNameIdDTO;
import com.appsmith.server.exceptions.AppsmithError;
import com.appsmith.server.exceptions.AppsmithException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.List;

@RequiredArgsConstructor
@Component
public class SanitiseResponse {

    public PageDTO sanitisePageDTO(PageDTO page) {
        DefaultResources defaults = page.getDefaultResources();
        if (defaults == null
                || StringUtils.isEmpty(defaults.getApplicationId())
                || StringUtils.isEmpty(defaults.getPageId())) {
            throw new AppsmithException(AppsmithError.DEFAULT_RESOURCES_UNAVAILABLE, "page", page.getId());
        }
        page.setApplicationId(defaults.getApplicationId());
        page.setId(defaults.getPageId());
        return page;
    }

    public ApplicationPagesDTO sanitiseApplicationPagesDTO(ApplicationPagesDTO applicationPages) {
        List<PageNameIdDTO> pageNameIdList = applicationPages.getPages();
        pageNameIdList.forEach(page -> {
            if (StringUtils.isEmpty(page.getGitDefaultPageId())) {
                throw new AppsmithException(AppsmithError.DEFAULT_RESOURCES_UNAVAILABLE, "applicationPage", page.getId());
            }
            page.setId(page.getGitDefaultPageId());
        });
        return applicationPages;
    }

    public ActionDTO sanitiseActionDTO(ActionDTO action) {
        DefaultResources defaults = action.getDefaultResources();
        if (defaults == null
                || StringUtils.isEmpty(defaults.getApplicationId())
                || StringUtils.isEmpty(defaults.getPageId())
                || StringUtils.isEmpty(defaults.getActionId())) {
            throw new AppsmithException(AppsmithError.DEFAULT_RESOURCES_UNAVAILABLE, "action", action.getId());
        }
        action.setApplicationId(defaults.getApplicationId());
        action.setPageId(defaults.getPageId());
        action.setId(defaults.getActionId());
        return action;
    }

    public LayoutDTO sanitiseLayoutDTO(LayoutDTO layout) {
        layout.getActionUpdates()
                .forEach(updateLayoutAction -> updateLayoutAction.setId(updateLayoutAction.getDefaultActionId()));

        layout.getLayoutOnLoadActions().forEach(layoutOnLoadAction ->
                layoutOnLoadAction.forEach(onLoadAction -> onLoadAction.setId(onLoadAction.getDefaultActionId())));
        return layout;
    }

    public ActionViewDTO sanitiseActionViewDTO(ActionViewDTO viewDTO) {
        DefaultResources defaults = viewDTO.getDefaultResources();
        if (defaults == null
                || StringUtils.isEmpty(defaults.getPageId())
                || StringUtils.isEmpty(defaults.getActionId())) {
            throw new AppsmithException(AppsmithError.DEFAULT_RESOURCES_UNAVAILABLE, "actionView", viewDTO.getId());
        }
        viewDTO.setId(defaults.getActionId());
        viewDTO.setPageId(defaults.getPageId());
        return viewDTO;
    }

    public Application sanitiseApplication(Application application) {
        if (application.getGitApplicationMetadata() != null
                && !StringUtils.isEmpty(application.getGitApplicationMetadata().getDefaultApplicationId())) {
            application.setId(application.getGitApplicationMetadata().getDefaultApplicationId());
        }
        application
                .getPages()
                .forEach(page -> {
                    if (!StringUtils.isEmpty(page.getDefaultPageId())) {
                        page.setId(page.getDefaultPageId());
                    }
                });
        return application;
    }

    public CommentThread sanitiseCommentThreadDTO(CommentThread commentThread) {
        DefaultResources defaults = commentThread.getDefaultResources();
        if (defaults == null
                || StringUtils.isEmpty(defaults.getApplicationId())
                || StringUtils.isEmpty(defaults.getPageId())) {
            throw new AppsmithException(AppsmithError.DEFAULT_RESOURCES_UNAVAILABLE, "commentThread", commentThread.getId());
        }
        commentThread.setApplicationId(defaults.getApplicationId());
        commentThread.setPageId(defaults.getPageId());
        return commentThread;
    }

    public <T> T updateDefaultResources(T resource, String branchName) {
        DefaultResources defaultResources = new DefaultResources();
        if (resource instanceof NewAction) {
            NewAction action = (NewAction) resource;
            defaultResources.setApplicationId(action.getApplicationId());
            defaultResources.setActionId(action.getId());
            defaultResources.setBranchName(branchName);
            action.setDefaultResources(defaultResources);
        } else if (resource instanceof ActionDTO) {
            ActionDTO action = (ActionDTO) resource;
            defaultResources.setPageId(action.getPageId());
            defaultResources.setActionCollectionId(action.getCollectionId());
            action.setDefaultResources(defaultResources);
        } else if (resource instanceof NewPage) {
            NewPage page = (NewPage) resource;
            defaultResources.setApplicationId(page.getApplicationId());
            defaultResources.setPageId(page.getId());
            defaultResources.setBranchName(branchName);
            page.setDefaultResources(defaultResources);
        } else if (resource instanceof ActionCollection) {
            ActionCollection actionCollection = (ActionCollection) resource;
            defaultResources.setApplicationId(actionCollection.getApplicationId());
            defaultResources.setActionCollectionId(actionCollection.getId());
            defaultResources.setBranchName(branchName);
            actionCollection.setDefaultResources(defaultResources);
        } else if (resource instanceof ActionCollectionDTO) {
            ActionCollectionDTO collectionDTO = (ActionCollectionDTO) resource;
            defaultResources.setPageId(collectionDTO.getPageId());
            collectionDTO.setDefaultResources(defaultResources);
        }
        return resource;
    }
}