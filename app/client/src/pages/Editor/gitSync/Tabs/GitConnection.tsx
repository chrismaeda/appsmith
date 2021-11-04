import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { Subtitle, Title, Space } from "../components/StyledComponents";
import {
  CONNECT_TO_GIT,
  CONNECT_TO_GIT_SUBTITLE,
  REMOTE_URL,
  REMOTE_URL_INFO,
  createMessage,
  DEPLOY_KEY_USAGE_GUIDE_MESSAGE,
  DEPLOY_KEY_TITLE,
  REMOTE_URL_INPUT_PLACEHOLDER,
  CONNECTING_REPO,
  ERROR_CONNECTING,
  CONFIRM_SSH_KEY,
  READ_DOCUMENTATION,
} from "constants/messages";
import styled from "styled-components";
import TextInput from "components/ads/TextInput";
import UserGitProfileSettings from "../components/UserGitProfileSettings";
import { AUTH_TYPE_OPTIONS } from "../constants";
import { Colors } from "constants/Colors";
import Button, { Category, Size } from "components/ads/Button";
import { useGitConnect, useSSHKeyPair } from "../hooks";
import { ReactComponent as KeySvg } from "assets/icons/ads/key-2-line.svg";
import { ReactComponent as CopySvg } from "assets/icons/ads/file-copy-line.svg";
import { ReactComponent as TickSvg } from "assets/images/tick.svg";
import { Toaster } from "components/ads/Toast";
import { Classes, Variant } from "components/ads/common";
import { useDispatch, useSelector } from "react-redux";
import copy from "copy-to-clipboard";
import { getCurrentAppGitMetaData } from "selectors/applicationSelectors";
import Text, { Case, FontWeight, TextType } from "components/ads/Text";
import { getGlobalGitConfig } from "selectors/gitSyncSelectors";
import {
  fetchGlobalGitConfigInit,
  fetchLocalGitConfigInit,
  updateLocalGitConfigInit,
} from "actions/gitSyncActions";
import TooltipComponent from "components/ads/Tooltip";
import { getLocalGitConfig } from "selectors/gitSyncSelectors";
import { emailValidator } from "components/ads/TextInput";
import { isEqual } from "lodash";
import {
  UPDATE_CONFIG,
  CONNECT_BTN_LABEL,
  PASTE_SSH_URL_INFO,
  GENERATE_KEY,
  COPIED_SSH_KEY,
  INVALID_USER_DETAILS_MSG,
} from "constants/messages";
import {
  getIsFetchingGlobalGitConfig,
  getIsFetchingLocalGitConfig,
} from "selectors/gitSyncSelectors";
import Statusbar from "pages/Editor/gitSync/components/Statusbar";
import AdsIcon, { IconSize } from "components/ads/Icon";
import ScrollIndicator from "components/ads/ScrollIndicator";
import { DOCS_BASE_URL } from "constants/ThirdPartyConstants";

export const UrlOptionContainer = styled.div`
  display: flex;
  align-items: center;

  & .primary {
  }
  margin-bottom: ${(props) => `${props.theme.spaces[3]}px`};
  margin-top: ${(props) => `${props.theme.spaces[11]}px`};
`;

const UrlContainer = styled.div`
  display: flex;
  align-items: center;
`;

const UrlInputContainer = styled.div`
  width: calc(100% - 30px);
  margin-right: 8px;
`;

const ButtonContainer = styled.div<{ topMargin: number }>`
  margin-top: ${(props) => `${props.theme.spaces[props.topMargin]}px`};
`;

const Icon = styled.span<{
  size: string;
  color: string;
  marginOffset?: number;
  hoverColor: string;
}>`
  display: flex;
  justify-content: center;
  align-items: center;
  margin: ${(props) => `${props.theme.spaces[props.marginOffset || 0]}px`};
  cursor: pointer;
  svg {
    width: ${(props) => props.size};
    height: ${(props) => props.size};
    path {
      fill: ${(props) => props.color};
    }
  }
  &:hover {
    svg {
      path {
        fill: ${(props) => props.hoverColor};
      }
    }
  }
`;

const DeployedKeyContainer = styled.div<{ $marginTop: number }>`
  margin-top: ${(props) => `${props.theme.spaces[props.$marginTop]}px`};
  margin-bottom: 8px;
  height: 50px;
  width: calc(100% - 30px);
  background-color: ${Colors.Gallery};
  padding: ${(props) =>
    `${props.theme.spaces[3]}px ${props.theme.spaces[4]}px`};
`;

const FlexColumn = styled.div`
  display: flex;
  flex-direction: column;
  width: 90%;
  margin-left: ${(props) => `${props.theme.spaces[4]}px`};
`;

const FlexRow = styled.div`
  display: flex;
  flex-direction: row;
  width: 100%;
`;

const Flex = styled.div`
  display: flex;
`;

const LabelText = styled.span`
  font-size: 14px;
  color: ${Colors.CODE_GRAY};
`;

const KeyText = styled.span`
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
  width: 100%;
  font-size: 10px;
  font-weight: 400;
  text-transform: uppercase;
  color: ${Colors.CODE_GRAY};
`;

const LintText = styled.a`
  :hover {
    text-decoration: none;
    color: ${Colors.CRUSTA};
  }
  color: ${Colors.CRUSTA};
  cursor: pointer;
`;

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  &::-webkit-scrollbar-thumb {
    background-color: transparent;
  }
  &::-webkit-scrollbar {
    width: 0px;
  }
`;

const TooltipWrapper = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
`;

const RemoteUrlInfoWrapper = styled.div`
  margin-top: ${(props) => props.theme.spaces[3]}px;
`;

const Section = styled.div``;
const StatusbarWrapper = styled.div`
  width: 252px;
`;

const ErrorWrapper = styled.div`
  padding: 24px 0px;
  .${Classes.TEXT} {
    display: block;
    margin-bottom: ${(props) => props.theme.spaces[3]}px;
    &.t--read-document {
      display: inline-flex;
      .${Classes.ICON} {
        margin-left: ${(props) => props.theme.spaces[3]}px;
      }
    }
  }
`;

// v1 only support SSH
const selectedAuthType = AUTH_TYPE_OPTIONS[0];
const HTTP_LITERAL = "https";

type Props = {
  isImport?: boolean;
};

function GitConnection({ isImport }: Props) {
  const { remoteUrl: remoteUrlInStore = "" } =
    useSelector(getCurrentAppGitMetaData) || ({} as any);

  const [remoteUrl, setRemoteUrl] = useState(remoteUrlInStore);
  const [processingGit, setProcessingGit] = useState(false);

  const isGitConnected = !!remoteUrlInStore;
  const isFetchingGlobalGitConfig = useSelector(getIsFetchingGlobalGitConfig);
  const isFetchingLocalGitConfig = useSelector(getIsFetchingLocalGitConfig);

  const globalGitConfig = useSelector(getGlobalGitConfig);
  const localGitConfig = useSelector(getLocalGitConfig);
  const isLocalConfigDefined = !!(
    localGitConfig.authorEmail || localGitConfig.authorName
  );

  const isGlobalConfigDefined = !!(
    globalGitConfig.authorEmail || globalGitConfig.authorName
  );

  const dispatch = useDispatch();

  const getInitGitConfig = useCallback(() => {
    let initialAuthInfo = {
      authorName: "",
      authorEmail: "",
    };

    if (isGlobalConfigDefined) {
      initialAuthInfo = {
        authorName: globalGitConfig.authorName || "",
        authorEmail: globalGitConfig.authorEmail || "",
      };
    }
    // when local config is defined we will only show local config
    if (isLocalConfigDefined) {
      initialAuthInfo = {
        authorName: localGitConfig.authorName || "",
        authorEmail: localGitConfig.authorEmail || "",
      };
    }

    return initialAuthInfo;
  }, [globalGitConfig, localGitConfig]);

  const initialAuthorInfoRef = useRef(getInitGitConfig());

  const [authorInfo, setAuthorInfo] = useState<{
    authorName: string;
    authorEmail: string;
  }>({
    authorName: initialAuthorInfoRef.current.authorName,
    authorEmail: initialAuthorInfoRef.current.authorEmail,
  });

  const [useGlobalConfig, setUseGlobalConfig] = useState(
    !isLocalConfigDefined && isGlobalConfigDefined,
  );

  const [isInvalidRemoteUrl, setIsValidRemoteUrl] = useState(false);
  const [showCopied, setShowCopied] = useState(false);
  const timerRef = useRef(0);

  const {
    deployKeyDocUrl,
    // failedGeneratingSSHKey,
    fetchingSSHKeyPair,
    fetchSSHKeyPair,
    generateSSHKey,
    generatingSSHKey,
    SSHKeyPair,
  } = useSSHKeyPair();

  const {
    connectToGit,
    failedConnectingToGit,
    isConnectingToGit,
  } = useGitConnect();

  const stopShowingCopiedAfterDelay = () => {
    timerRef.current = setTimeout(() => {
      setShowCopied(false);
    }, 2000);
  };

  useEffect(() => {
    // On unmount clear timer to avoid memory leak
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const copyToClipboard = () => {
    if (SSHKeyPair) {
      copy(SSHKeyPair);
      setShowCopied(true);
      stopShowingCopiedAfterDelay();

      Toaster.show({
        text: createMessage(COPIED_SSH_KEY),
        variant: Variant.success,
      });
    }
  };

  useEffect(() => {
    // when disconnected remoteURL becomes undefined
    if (!remoteUrlInStore) {
      setRemoteUrl("");
    }
  }, [remoteUrlInStore]);

  const placeholderText = createMessage(REMOTE_URL_INPUT_PLACEHOLDER);

  const isAuthorInfoUpdated = useCallback(() => {
    return (
      !isEqual(
        authorInfo.authorEmail,
        initialAuthorInfoRef.current.authorEmail,
      ) ||
      !isEqual(authorInfo.authorName, initialAuthorInfoRef.current.authorName)
    );
  }, [
    authorInfo.authorEmail,
    authorInfo.authorName,
    initialAuthorInfoRef.current.authorEmail,
    initialAuthorInfoRef.current.authorName,
  ]);

  const isRemoteUrlUpdated = () => {
    return remoteUrl !== remoteUrlInStore;
  };

  const onSubmit = useCallback(() => {
    if (
      authorInfo.authorName &&
      authorInfo.authorEmail &&
      emailValidator(authorInfo.authorEmail).isValid
    ) {
      // Also check if useDefaultConfig switch is changed
      setProcessingGit(true);
      if (isGitConnected && !isRemoteUrlUpdated()) {
        if (isAuthorInfoUpdated()) {
          // just update local config
          dispatch(updateLocalGitConfigInit(authorInfo));
        }
      } else {
        connectToGit({
          remoteUrl,
          gitProfile: authorInfo,
          isImport,
          isDefaultProfile: useGlobalConfig,
        });
      }
    } else {
      Toaster.show({
        text: createMessage(INVALID_USER_DETAILS_MSG),
      });
    }
  }, [
    updateLocalGitConfigInit,
    isAuthorInfoUpdated,
    isRemoteUrlUpdated,
    connectToGit,
    useGlobalConfig,
  ]);

  useEffect(() => {
    // On mount check SSHKeyPair is defined, if not fetchSSHKeyPair
    if (!SSHKeyPair) {
      fetchSSHKeyPair();
    }
  }, [SSHKeyPair]);

  const remoteUrlChangeHandler = (value: string) => {
    const isInvalid = remoteUrlIsInvalid(value);
    setIsValidRemoteUrl(isInvalid);
    setRemoteUrl(value);
  };

  const remoteUrlIsInvalid = useCallback(
    (value: string) => value.startsWith(HTTP_LITERAL),
    [],
  );

  const submitButtonDisabled = useMemo(() => {
    const isAuthorInfoEmpty = !authorInfo.authorEmail || !authorInfo.authorName;
    const isAuthorEmailInvalid = !emailValidator(authorInfo.authorEmail)
      .isValid;
    const isAuthInfoUpdated = isAuthorInfoUpdated();
    let buttonDisabled = isAuthorInfoEmpty || isAuthorEmailInvalid;
    if (isGitConnected) {
      buttonDisabled = buttonDisabled || !isAuthInfoUpdated;
    }
    return buttonDisabled;
  }, [
    authorInfo.authorEmail,
    authorInfo.authorName,
    isAuthorInfoUpdated,
    isGitConnected,
  ]);

  const submitButtonIsLoading = useMemo(() => {
    const isFetchingConfig =
      isGitConnected && (isFetchingGlobalGitConfig || isFetchingLocalGitConfig);
    return isConnectingToGit || isFetchingConfig;
  }, [isConnectingToGit, isFetchingGlobalGitConfig, isFetchingLocalGitConfig]);

  useEffect(() => {
    // OnMount fetch global and local config
    dispatch(fetchGlobalGitConfigInit());
    dispatch(fetchLocalGitConfigInit());
  }, []);

  useEffect(() => {
    // on local config update
    const newAuthConfig = getInitGitConfig();
    setAuthorInfo(newAuthConfig);
    initialAuthorInfoRef.current = newAuthConfig;
  }, [
    localGitConfig.authorEmail,
    localGitConfig.authorName,
    setAuthorInfo,
    globalGitConfig.authorEmail,
    globalGitConfig.authorEmail,
  ]);

  const toggleHandler = useCallback(() => {
    setUseGlobalConfig(!useGlobalConfig);
  }, [setUseGlobalConfig, useGlobalConfig]);

  const hideStatusBar = useCallback(() => {
    setProcessingGit(false);
  }, []);
  const scrollWrapperRef = React.createRef<HTMLDivElement>();
  useEffect(() => {
    if (failedConnectingToGit && scrollWrapperRef.current) {
      const top = scrollWrapperRef.current.scrollHeight;
      scrollWrapperRef.current?.scrollTo({ top: top, behavior: "smooth" });
    }
  }, [failedConnectingToGit]);

  return (
    <Container ref={scrollWrapperRef}>
      <Section>
        <Title>{createMessage(CONNECT_TO_GIT)}</Title>
        <Subtitle>{createMessage(CONNECT_TO_GIT_SUBTITLE)}</Subtitle>
        <UrlOptionContainer>
          <Text color={Colors.GREY_9} type={TextType.P1}>
            {createMessage(REMOTE_URL)}
          </Text>
        </UrlOptionContainer>
        <UrlContainer>
          <UrlInputContainer>
            <TextInput
              className="t--git-repo-input"
              disabled={remoteUrl === remoteUrlInStore && !!remoteUrl}
              errorMsg={
                isInvalidRemoteUrl ? createMessage(PASTE_SSH_URL_INFO) : ""
              }
              fill
              onChange={remoteUrlChangeHandler}
              placeholder={placeholderText}
              value={remoteUrl}
            />
          </UrlInputContainer>
        </UrlContainer>

        {!isInvalidRemoteUrl && !SSHKeyPair ? (
          <RemoteUrlInfoWrapper>
            <Text color={Colors.GREY_9} type={TextType.P3}>
              {createMessage(REMOTE_URL_INFO)}
            </Text>
          </RemoteUrlInfoWrapper>
        ) : null}

        {!SSHKeyPair ? (
          remoteUrl && (
            <ButtonContainer topMargin={10}>
              <Button
                category={Category.primary}
                className="t--submit-repo-url-button"
                disabled={!remoteUrl || isInvalidRemoteUrl}
                isLoading={generatingSSHKey || fetchingSSHKeyPair}
                onClick={() => generateSSHKey()}
                size={Size.large}
                tag="button"
                text={createMessage(GENERATE_KEY)}
              />
            </ButtonContainer>
          )
        ) : (
          <>
            <FlexRow>
              <DeployedKeyContainer $marginTop={8}>
                <FlexRow>
                  <Flex>
                    <KeySvg />
                  </Flex>

                  <FlexColumn>
                    <LabelText>{createMessage(DEPLOY_KEY_TITLE)}</LabelText>
                    <KeyText>{SSHKeyPair}</KeyText>
                  </FlexColumn>
                </FlexRow>
              </DeployedKeyContainer>
              {showCopied ? (
                <Icon
                  color={Colors.GREEN}
                  hoverColor={Colors.GREEN}
                  marginOffset={4}
                  size="16px"
                >
                  <TickSvg />
                </Icon>
              ) : (
                <TooltipWrapper>
                  <TooltipComponent content="Copy Key">
                    <Icon
                      color={Colors.DARK_GRAY}
                      hoverColor={Colors.GRAY2}
                      marginOffset={3}
                      onClick={copyToClipboard}
                      size="22px"
                    >
                      <CopySvg />
                    </Icon>
                  </TooltipComponent>
                </TooltipWrapper>
              )}
            </FlexRow>
            <Text color={Colors.GREY_9} type={TextType.P3}>
              {createMessage(DEPLOY_KEY_USAGE_GUIDE_MESSAGE)}
              <LintText href={deployKeyDocUrl} target="_blank">
                &nbsp;LEARN MORE
              </LintText>
            </Text>
          </>
        )}
      </Section>

      {SSHKeyPair && remoteUrl ? (
        <>
          <Space size={7} />
          <UserGitProfileSettings
            authType={selectedAuthType.label || ""}
            authorInfo={useGlobalConfig ? globalGitConfig : authorInfo}
            isGlobalConfigDefined={isGlobalConfigDefined}
            isLocalConfigDefined={isLocalConfigDefined}
            setAuthorInfo={setAuthorInfo}
            toggleUseDefaultConfig={toggleHandler}
            useGlobalConfig={useGlobalConfig}
          />
          <ButtonContainer topMargin={11}>
            {!failedConnectingToGit && processingGit && (
              <StatusbarWrapper>
                <Statusbar
                  completed={!submitButtonIsLoading}
                  message={createMessage(CONNECTING_REPO)}
                  onHide={hideStatusBar}
                  period={4}
                />
              </StatusbarWrapper>
            )}
            {!processingGit && (
              <Button
                category={
                  isGitConnected ? Category.secondary : Category.primary
                }
                className="t--connect-submit-btn"
                disabled={submitButtonDisabled}
                isLoading={submitButtonIsLoading}
                onClick={onSubmit}
                size={Size.large}
                tag="button"
                text={
                  isGitConnected
                    ? createMessage(UPDATE_CONFIG)
                    : createMessage(CONNECT_BTN_LABEL)
                }
              />
            )}
            {failedConnectingToGit && (
              <ErrorWrapper>
                <Text
                  case={Case.UPPERCASE}
                  color={Colors.ERROR_RED}
                  type={TextType.P1}
                  weight={FontWeight.BOLD}
                >
                  {createMessage(ERROR_CONNECTING)}
                </Text>
                <Text color={Colors.ERROR_RED} type={TextType.P2}>
                  {createMessage(CONFIRM_SSH_KEY)}
                </Text>
                <LintText href={DOCS_BASE_URL} target="_blank">
                  <Text
                    case={Case.UPPERCASE}
                    className="t--read-document"
                    color={Colors.CHARCOAL}
                    type={TextType.P3}
                    weight={FontWeight.BOLD}
                  >
                    {createMessage(READ_DOCUMENTATION)}
                    <AdsIcon name="right-arrow" size={IconSize.SMALL} />
                  </Text>
                </LintText>
              </ErrorWrapper>
            )}
          </ButtonContainer>
        </>
      ) : null}
      <ScrollIndicator containerRef={scrollWrapperRef} mode="DARK" top="47px" />
    </Container>
  );
}

export default GitConnection;
