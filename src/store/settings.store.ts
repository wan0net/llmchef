import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { PersistenceService } from "@/services/persistence.service";
import {
  createDefaultAutoTitleSettings,
  createDefaultConfigSyncSettings,
  createDefaultThemeSettings,
  createDefaultToolSelectionSettings,
  DEFAULT_THEME,
  SettingsPersistenceService,
} from "@/services/settings-persistence.service";
import { toast } from "sonner";
import { emitter } from "@/lib/llmchef/event-emitter";
import {
  settingsEvent,
  SettingsEventPayloads,
} from "@/types/llmchef/events/settings.events";
import { controlRegistryEvent } from "@/types/llmchef/events/control.registry.events";
import type { RegisteredActionHandler } from "@/types/llmchef/control";
import { createSettingsSliceActionFactory } from "./settings-slice-actions";
import type {
  AutoTitleSettings,
  ConfigSyncSettings,
  CustomThemeColors,
  SettingsState,
  ThemeSettings,
  ToolSelectionSettings,
} from "@/types/llmchef/settings";
import { BUNDLED_SYSTEM_PROMPT } from "virtual:system-prompt";
import { useControlRegistryStore } from "./control.store";

interface SettingsActions {
  setTheme: (theme: SettingsState["theme"]) => void;
  setGlobalSystemPrompt: (prompt: string | null) => void;
  setTemperature: (temp: number | null) => void;
  setMaxTokens: (tokens: number | null) => void;
  setTopP: (topP: number | null) => void;
  setTopK: (topK: number | null) => void;
  setPresencePenalty: (penalty: number | null) => void;
  setFrequencyPenalty: (penalty: number | null) => void;
  setEnableAdvancedSettings: (enabled: boolean) => void;
  setEnableStreamingMarkdown: (enabled: boolean) => void;
  setEnableStreamingCodeBlockParsing: (enabled: boolean) => void;
  setFoldStreamingCodeBlocks: (fold: boolean) => void;
  setFoldUserMessagesOnCompletion: (fold: boolean) => void;
  setStreamingRenderFPS: (fps: number) => void;
  setGitUserName: (name: string | null) => void;
  setGitUserEmail: (email: string | null) => void;
  setGitGlobalPat: (pat: string | null) => void;
  setToolMaxSteps: (steps: number) => void;
  setPrismThemeUrl: (url: string | null) => void;
  setAutoTitleEnabled: (enabled: boolean) => void;
  setAutoTitleAlwaysOn: (enabled: boolean) => void;
  setAutoTitleModelId: (modelId: string | null) => void;
  setAutoTitlePromptMaxLength: (length: number) => void;
  setAutoTitleIncludeFiles: (include: boolean) => void;
  setAutoTitleIncludeRules: (include: boolean) => void;
  setForkCompactPrompt: (prompt: string | null) => void;
  setForkCompactModelId: (modelId: string | null) => void;
  setCustomFontFamily: (fontFamily: string | null) => void;
  setCustomFontSize: (fontSize: number | null) => void;
  setChatMaxWidth: (maxWidthClass: string | null) => void;
  setCustomThemeColors: (colors: CustomThemeColors | null) => void;
  setCustomThemeColor: (
    colorName: keyof CustomThemeColors,
    value: string | null
  ) => void;
  setAutoScrollInterval: (interval: number) => void;
  setEnableAutoScrollOnStream: (enabled: boolean) => void;
  setAutoSyncOnStreamComplete: (enabled: boolean) => void;
  setAutoInitializeReposOnStartup: (enabled: boolean) => void;
  setControlRuleAlwaysOn: (ruleId: string, alwaysOn: boolean) => void;
  setAutoRuleSelectionEnabled: (enabled: boolean) => void;
  setAutoRuleSelectionModelId: (modelId: string | null) => void;
  setAutoRuleSelectionPrompt: (prompt: string | null) => void;
  setRunnableBlocksEnabled: (enabled: boolean) => void;
  setRunnableBlocksSecurityCheckEnabled: (enabled: boolean) => void;
  setRunnableBlocksSecurityModelId: (modelId: string | null) => void;
  setRunnableBlocksSecurityPrompt: (prompt: string | null) => void;
  
  // Auto Tool Selection Actions
  setAutoToolSelectionEnabled: (enabled: boolean) => void;
  setAutoToolSelectionModelId: (modelId: string | null) => void;
  setAutoToolSelectionPrompt: (prompt: string | null) => void;
  
  // Text Trigger Actions
  setTextTriggersEnabled: (enabled: boolean) => void;
  setTextTriggerDelimiters: (start: string, end: string) => void;
  
  // Config Sync Actions
  setConfigSyncEnabled: (enabled: boolean) => void;
  setConfigSyncRepoId: (repoId: string | null) => void;
  setConfigSyncAutoSync: (enabled: boolean) => void;
  setConfigSyncIncludeSettings: (include: boolean) => void;
  setConfigSyncIncludeRules: (include: boolean) => void;
  setConfigSyncIncludePromptTemplates: (include: boolean) => void;
  setConfigSyncIncludeAgents: (include: boolean) => void;
  setConfigSyncIncludeWorkflows: (include: boolean) => void;
  setConfigSyncIncludeMcpServers: (include: boolean) => void;
  setConfigSyncLastSyncedAt: (timestamp: string | null) => void;
  setConfigSyncInterval: (interval: number) => void;
  
  // Service URL Actions
  setCorsProxyUrl: (url: string) => void;
  setMarkdownServiceUrl: (url: string) => void;
  
  loadSettings: () => Promise<void>;
  resetGeneralSettings: () => Promise<void>;
  resetAssistantSettings: () => Promise<void>;
  resetThemeSettings: () => Promise<void>;
  getRegisteredActionHandlers: () => RegisteredActionHandler[];
}

// Define default constants
const DEFAULT_SYSTEM_PROMPT = BUNDLED_SYSTEM_PROMPT;
const DEFAULT_TEMPERATURE = null;
const DEFAULT_MAX_TOKENS = null;
const DEFAULT_TOP_P = null;
const DEFAULT_TOP_K = null;
const DEFAULT_PRESENCE_PENALTY = 0.0;
const DEFAULT_FREQUENCY_PENALTY = 0.0;
const DEFAULT_ENABLE_ADVANCED_SETTINGS = false;
const DEFAULT_ENABLE_STREAMING_MARKDOWN = true;
const DEFAULT_ENABLE_STREAMING_CODE_BLOCK_PARSING = true;
const DEFAULT_FOLD_STREAMING_CODE_BLOCKS = false;
const DEFAULT_FOLD_USER_MESSAGES_ON_COMPLETION = false;
const DEFAULT_STREAMING_FPS = 15;
const DEFAULT_GIT_USER_NAME = null;
const DEFAULT_GIT_USER_EMAIL = null;
const DEFAULT_GIT_GLOBAL_PAT = null;
const DEFAULT_FORK_COMPACT_PROMPT = null;
const DEFAULT_FORK_COMPACT_MODEL_ID = null;
const DEFAULT_AUTO_SCROLL_INTERVAL = 1000;
const DEFAULT_ENABLE_AUTO_SCROLL_ON_STREAM = true;
const DEFAULT_AUTO_SYNC_ON_STREAM_COMPLETE = false;
const DEFAULT_AUTO_INITIALIZE_REPOS_ON_STARTUP = false;
const DEFAULT_CONTROL_RULE_ALWAYS_ON = {};
const DEFAULT_AUTO_RULE_SELECTION_ENABLED = false;
const DEFAULT_AUTO_RULE_SELECTION_MODEL_ID = null;
const DEFAULT_AUTO_RULE_SELECTION_PROMPT =
  "Given the following user prompt and the list of available rules, select the most relevant rules for this conversation. Return a JSON array of rule IDs.\n\nUser Prompt: {{prompt}}\n\nAvailable Rules:\n{{rules}}\n\nReturn only a JSON array of rule IDs.";
const DEFAULT_RUNNABLE_BLOCKS_ENABLED = true;
const DEFAULT_RUNNABLE_BLOCKS_SECURITY_CHECK_ENABLED = true;
const DEFAULT_RUNNABLE_BLOCKS_SECURITY_MODEL_ID = null;
const DEFAULT_RUNNABLE_BLOCKS_SECURITY_PROMPT =
  "Analyze the following code for potential security risks or malicious behavior. Respond with ONLY a number from 0 to 100 where:\n- 0-30: Safe code (reading data, basic calculations, simple DOM manipulation)\n- 31-60: Moderate risk (file operations, network requests, eval usage)\n- 61-90: High risk (system commands, dangerous APIs, potential privacy violations)\n- 91-100: Extremely dangerous (malware, destructive operations, clear security threats)\n\nCode to analyze:\n{{code}}\n\nReturn only the numeric risk score (0-100).";

// Text Trigger Settings
const DEFAULT_TEXT_TRIGGERS_ENABLED = true;
const DEFAULT_TEXT_TRIGGER_START_DELIMITER = "@.";
const DEFAULT_TEXT_TRIGGER_END_DELIMITER = ";";

// Service URLs
const DEFAULT_CORS_PROXY_URL = "";
const DEFAULT_MARKDOWN_SERVICE_URL = "";

const LEGACY_SETTINGS_KEYS: (keyof SettingsState)[] = [
  "globalSystemPrompt",
  "temperature",
  "maxTokens",
  "topP",
  "topK",
  "presencePenalty",
  "frequencyPenalty",
  "enableAdvancedSettings",
  "enableStreamingMarkdown",
  "enableStreamingCodeBlockParsing",
  "foldStreamingCodeBlocks",
  "foldUserMessagesOnCompletion",
  "streamingRenderFPS",
  "gitUserName",
  "gitUserEmail",
  "gitGlobalPat",
  "forkCompactPrompt",
  "forkCompactModelId",
  "autoScrollInterval",
  "enableAutoScrollOnStream",
  "autoSyncOnStreamComplete",
  "autoInitializeReposOnStartup",
  "controlRuleAlwaysOn",
  "autoRuleSelectionEnabled",
  "autoRuleSelectionModelId",
  "autoRuleSelectionPrompt",
  "runnableBlocksEnabled",
  "runnableBlocksSecurityCheckEnabled",
  "runnableBlocksSecurityModelId",
  "runnableBlocksSecurityPrompt",
  "textTriggersEnabled",
  "textTriggerStartDelimiter",
  "textTriggerEndDelimiter",
  "corsProxyUrl",
  "markdownServiceUrl",
];

const persistSetting = async <K extends keyof SettingsState>(
  key: K,
  value: SettingsState[K]
) => {
  try {
    await PersistenceService.saveSetting(key, value);
    emitter.emit(settingsEvent.settingsChanged, { [key]: value });
  } catch (error) {
    console.error(`SettingsStore: Failed to persist setting ${String(key)}:`, error);
    toast.error(`Failed to save setting ${String(key)}`);
  }
};

const persistSettingsSlice = async (
  partial: Partial<SettingsState>,
  persist: () => Promise<void>,
) => {
  try {
    await persist();
    emitter.emit(settingsEvent.settingsChanged, partial);
  } catch (error) {
    console.error("SettingsStore: Failed to persist settings slice:", error);
    toast.error("Failed to save settings");
  }
};

const emitSettingsChangedEntries = (partial: Partial<SettingsState>) => {
  for (const [key, value] of Object.entries(partial)) {
    emitter.emit(settingsEvent.settingsChanged, { [key]: value });
  }
};

export const useSettingsStore = create(
  immer<SettingsState & SettingsActions>((set, get) => {
    const setState = (partial: Partial<SettingsState>) => set(partial);

    const createThemeSettingAction = createSettingsSliceActionFactory<ThemeSettings>({
      setState,
      persist: SettingsPersistenceService.saveThemeSettings,
      persistStateSlice: (partial, persist) => void persistSettingsSlice(partial, persist),
    });

    const createAutoTitleSettingAction =
      createSettingsSliceActionFactory<AutoTitleSettings>({
        setState,
        persist: SettingsPersistenceService.saveAutoTitleSettings,
        persistStateSlice: (partial, persist) => void persistSettingsSlice(partial, persist),
      });

    const createToolSelectionSettingAction =
      createSettingsSliceActionFactory<ToolSelectionSettings>({
        setState,
        persist: SettingsPersistenceService.saveToolSelectionSettings,
        persistStateSlice: (partial, persist) => void persistSettingsSlice(partial, persist),
      });

    const createConfigSyncSettingAction =
      createSettingsSliceActionFactory<ConfigSyncSettings>({
        setState,
        persist: SettingsPersistenceService.saveConfigSyncSettings,
        persistStateSlice: (partial, persist) => void persistSettingsSlice(partial, persist),
      });

    return ({
    theme: DEFAULT_THEME,
    globalSystemPrompt: DEFAULT_SYSTEM_PROMPT,
    temperature: DEFAULT_TEMPERATURE,
    maxTokens: DEFAULT_MAX_TOKENS,
    topP: DEFAULT_TOP_P,
    topK: DEFAULT_TOP_K,
    presencePenalty: DEFAULT_PRESENCE_PENALTY,
    frequencyPenalty: DEFAULT_FREQUENCY_PENALTY,
    enableAdvancedSettings: DEFAULT_ENABLE_ADVANCED_SETTINGS,
    enableStreamingMarkdown: DEFAULT_ENABLE_STREAMING_MARKDOWN,
    enableStreamingCodeBlockParsing:
      DEFAULT_ENABLE_STREAMING_CODE_BLOCK_PARSING,
    foldStreamingCodeBlocks: DEFAULT_FOLD_STREAMING_CODE_BLOCKS,
    foldUserMessagesOnCompletion: DEFAULT_FOLD_USER_MESSAGES_ON_COMPLETION,
    streamingRenderFPS: DEFAULT_STREAMING_FPS,
    gitUserName: DEFAULT_GIT_USER_NAME,
    gitUserEmail: DEFAULT_GIT_USER_EMAIL,
    gitGlobalPat: DEFAULT_GIT_GLOBAL_PAT,
    ...createDefaultToolSelectionSettings(),
    ...createDefaultAutoTitleSettings(),
    forkCompactPrompt: DEFAULT_FORK_COMPACT_PROMPT,
    forkCompactModelId: DEFAULT_FORK_COMPACT_MODEL_ID,
    ...createDefaultThemeSettings(),
    autoScrollInterval: DEFAULT_AUTO_SCROLL_INTERVAL,
    enableAutoScrollOnStream: DEFAULT_ENABLE_AUTO_SCROLL_ON_STREAM,
    autoSyncOnStreamComplete: DEFAULT_AUTO_SYNC_ON_STREAM_COMPLETE,
    autoInitializeReposOnStartup: DEFAULT_AUTO_INITIALIZE_REPOS_ON_STARTUP,
    controlRuleAlwaysOn: DEFAULT_CONTROL_RULE_ALWAYS_ON,
    autoRuleSelectionEnabled: DEFAULT_AUTO_RULE_SELECTION_ENABLED,
    autoRuleSelectionModelId: DEFAULT_AUTO_RULE_SELECTION_MODEL_ID,
    autoRuleSelectionPrompt: DEFAULT_AUTO_RULE_SELECTION_PROMPT,
    runnableBlocksEnabled: DEFAULT_RUNNABLE_BLOCKS_ENABLED,
    runnableBlocksSecurityCheckEnabled: DEFAULT_RUNNABLE_BLOCKS_SECURITY_CHECK_ENABLED,
    runnableBlocksSecurityModelId: DEFAULT_RUNNABLE_BLOCKS_SECURITY_MODEL_ID,
    runnableBlocksSecurityPrompt: DEFAULT_RUNNABLE_BLOCKS_SECURITY_PROMPT,
    
    // Text Trigger Settings
    textTriggersEnabled: DEFAULT_TEXT_TRIGGERS_ENABLED,
    textTriggerStartDelimiter: DEFAULT_TEXT_TRIGGER_START_DELIMITER,
    textTriggerEndDelimiter: DEFAULT_TEXT_TRIGGER_END_DELIMITER,
    
    // Config Sync Settings
    ...createDefaultConfigSyncSettings(),
    
    // Service URLs
    corsProxyUrl: DEFAULT_CORS_PROXY_URL,
    markdownServiceUrl: DEFAULT_MARKDOWN_SERVICE_URL,

    setTheme: (theme) => {
      set({ theme });
      void persistSettingsSlice({ theme }, () =>
        SettingsPersistenceService.saveThemeSettings({ theme }),
      );
      emitter.emit(settingsEvent.themeChanged, { theme });
    },
    setGlobalSystemPrompt: (prompt) => {
      set({ globalSystemPrompt: prompt });
      void persistSetting("globalSystemPrompt", prompt);
      emitter.emit(settingsEvent.globalSystemPromptChanged, { prompt });
    },
    setTemperature: (temp) => {
      set({ temperature: temp });
      void persistSetting("temperature", temp);
      emitter.emit(settingsEvent.temperatureChanged, { value: temp });
    },
    setMaxTokens: (tokens) => {
      set({ maxTokens: tokens });
      void persistSetting("maxTokens", tokens);
      emitter.emit(settingsEvent.maxTokensChanged, { value: tokens });
    },
    setTopP: (topP) => {
      set({ topP: topP });
      void persistSetting("topP", topP);
      emitter.emit(settingsEvent.topPChanged, { value: topP });
    },
    setTopK: (topK) => {
      set({ topK: topK });
      void persistSetting("topK", topK);
      emitter.emit(settingsEvent.topKChanged, { value: topK });
    },
    setPresencePenalty: (penalty) => {
      set({ presencePenalty: penalty });
      void persistSetting("presencePenalty", penalty);
      emitter.emit(settingsEvent.presencePenaltyChanged, { value: penalty });
    },
    setFrequencyPenalty: (penalty) => {
      set({ frequencyPenalty: penalty });
      void persistSetting("frequencyPenalty", penalty);
      emitter.emit(settingsEvent.frequencyPenaltyChanged, { value: penalty });
    },
    setEnableAdvancedSettings: (enabled) => {
      set({ enableAdvancedSettings: enabled });
      void persistSetting("enableAdvancedSettings", enabled);
      emitter.emit(settingsEvent.enableAdvancedSettingsChanged, { enabled });
    },
    setEnableStreamingMarkdown: (enabled) => {
      set({ enableStreamingMarkdown: enabled });
      void persistSetting("enableStreamingMarkdown", enabled);
      emitter.emit(settingsEvent.enableStreamingMarkdownChanged, { enabled });
    },
    setEnableStreamingCodeBlockParsing: (enabled) => {
      set({ enableStreamingCodeBlockParsing: enabled });
      void persistSetting("enableStreamingCodeBlockParsing", enabled);
      emitter.emit(settingsEvent.enableStreamingCodeBlockParsingChanged, { enabled });
    },
    setFoldStreamingCodeBlocks: (fold) => {
      set({ foldStreamingCodeBlocks: fold });
      void persistSetting("foldStreamingCodeBlocks", fold);
      emitter.emit(settingsEvent.foldStreamingCodeBlocksChanged, { fold });
    },
    setFoldUserMessagesOnCompletion: (fold) => {
      set({ foldUserMessagesOnCompletion: fold });
      void persistSetting("foldUserMessagesOnCompletion", fold);
      emitter.emit(settingsEvent.foldUserMessagesOnCompletionChanged, { fold });
    },
    setStreamingRenderFPS: (fps) => {
      // Clamp FPS to 3-60
      const clamped = Math.max(3, Math.min(60, fps));
      set({ streamingRenderFPS: clamped });
      void persistSetting("streamingRenderFPS", clamped);
      emitter.emit(settingsEvent.streamingRenderFpsChanged, { fps: clamped });
    },
    setGitUserName: (name) => {
      // Trim whitespace
      const trimmed = name ? name.trim() : name;
      set({ gitUserName: trimmed });
      void persistSetting("gitUserName", trimmed);
      emitter.emit(settingsEvent.gitUserNameChanged, { name: trimmed });
    },
    setGitUserEmail: (email) => {
      // Trim whitespace
      const trimmed = email ? email.trim() : email;
      set({ gitUserEmail: trimmed });
      void persistSetting("gitUserEmail", trimmed);
      emitter.emit(settingsEvent.gitUserEmailChanged, { email: trimmed });
    },
    setGitGlobalPat: (pat) => {
      set({ gitGlobalPat: pat });
      void persistSetting("gitGlobalPat", pat);
      emitter.emit(settingsEvent.gitGlobalPatChanged, { pat });
    },
    setToolMaxSteps: createToolSelectionSettingAction(
      "toolMaxSteps",
      (steps) => emitter.emit(settingsEvent.toolMaxStepsChanged, { steps }),
      (steps) => Math.max(1, Math.min(20, steps)),
    ),
    setPrismThemeUrl: createThemeSettingAction(
      "prismThemeUrl",
      (url) => emitter.emit(settingsEvent.prismThemeUrlChanged, { url }),
    ),
    setAutoTitleEnabled: createAutoTitleSettingAction(
      "autoTitleEnabled",
      (enabled) => emitter.emit(settingsEvent.autoTitleEnabledChanged, { enabled }),
    ),
    setAutoTitleAlwaysOn: createAutoTitleSettingAction(
      "autoTitleAlwaysOn",
      (enabled) => emitter.emit(settingsEvent.autoTitleAlwaysOnChanged, { enabled }),
    ),
    setAutoTitleModelId: createAutoTitleSettingAction(
      "autoTitleModelId",
      (modelId) => emitter.emit(settingsEvent.autoTitleModelIdChanged, { modelId }),
    ),
    setAutoTitlePromptMaxLength: createAutoTitleSettingAction(
      "autoTitlePromptMaxLength",
      (length) => emitter.emit(settingsEvent.autoTitlePromptMaxLengthChanged, { length }),
      (length) => Math.max(32, Math.min(4096, length)),
    ),
    setAutoTitleIncludeFiles: createAutoTitleSettingAction(
      "autoTitleIncludeFiles",
      (include) => emitter.emit(settingsEvent.autoTitleIncludeFilesChanged, { include }),
    ),
    setAutoTitleIncludeRules: createAutoTitleSettingAction(
      "autoTitleIncludeRules",
      (include) => emitter.emit(settingsEvent.autoTitleIncludeRulesChanged, { include }),
    ),
    setForkCompactPrompt: (prompt) => {
      set({ forkCompactPrompt: prompt });
      void persistSetting("forkCompactPrompt", prompt);
      emitter.emit(settingsEvent.forkCompactPromptChanged, { prompt });
    },
    setForkCompactModelId: (modelId) => {
      set({ forkCompactModelId: modelId });
      void persistSetting("forkCompactModelId", modelId);
      emitter.emit(settingsEvent.forkCompactModelIdChanged, { modelId });
    },
    setCustomFontFamily: createThemeSettingAction(
      "customFontFamily",
      (fontFamily) => emitter.emit(settingsEvent.customFontFamilyChanged, { fontFamily }),
    ),
    setCustomFontSize: createThemeSettingAction(
      "customFontSize",
      (fontSize) => emitter.emit(settingsEvent.customFontSizeChanged, { fontSize }),
      (fontSize) =>
        typeof fontSize === "number"
          ? Math.max(10, Math.min(24, fontSize))
          : fontSize,
    ),
    setChatMaxWidth: createThemeSettingAction(
      "chatMaxWidth",
      (maxWidth) => emitter.emit(settingsEvent.chatMaxWidthChanged, { maxWidth }),
    ),
    setCustomThemeColors: createThemeSettingAction(
      "customThemeColors",
      (colors) => emitter.emit(settingsEvent.customThemeColorsChanged, { colors }),
    ),
    setCustomThemeColor: (colorName, value) => {
      set((state) => {
        if (!state.customThemeColors) {
          state.customThemeColors = {};
        }
        if (value) {
          state.customThemeColors[colorName] = value;
        } else {
          delete state.customThemeColors[colorName];
        }
      });
      const colors = get().customThemeColors;
      void void persistSettingsSlice({ customThemeColors: colors }, () =>
        SettingsPersistenceService.saveThemeSettings({ customThemeColors: colors }),
      );
      emitter.emit(settingsEvent.customThemeColorsChanged, { colors });
    },
    setAutoScrollInterval: (interval) => {
      set({ autoScrollInterval: interval });
      void persistSetting("autoScrollInterval", interval);
      emitter.emit(settingsEvent.autoScrollIntervalChanged, { interval });
    },
    setEnableAutoScrollOnStream: (enabled) => {
      set({ enableAutoScrollOnStream: enabled });
      void persistSetting("enableAutoScrollOnStream", enabled);
      emitter.emit(settingsEvent.enableAutoScrollOnStreamChanged, { enabled });
    },
    setAutoSyncOnStreamComplete: (enabled) => {
      set({ autoSyncOnStreamComplete: enabled });
      void persistSetting("autoSyncOnStreamComplete", enabled);
      emitter.emit(settingsEvent.autoSyncOnStreamCompleteChanged, { enabled });
    },
    setAutoInitializeReposOnStartup: (enabled) => {
      set({ autoInitializeReposOnStartup: enabled });
      void persistSetting("autoInitializeReposOnStartup", enabled);
      emitter.emit(settingsEvent.autoInitializeReposOnStartupChanged, { enabled });
    },
    setControlRuleAlwaysOn: (ruleId, alwaysOn) => {
      set((state) => {
        state.controlRuleAlwaysOn[ruleId] = alwaysOn;
      });
      void persistSetting("controlRuleAlwaysOn", get().controlRuleAlwaysOn);
      emitter.emit(settingsEvent.controlRuleAlwaysOnChanged, { ruleId, alwaysOn });
      emitter.emit(controlRegistryEvent.controlRulesChanged, {
        controlRules: useControlRegistryStore.getState().getControlRules(),
      });
    },
    setAutoRuleSelectionEnabled: (enabled) => {
      set({ autoRuleSelectionEnabled: enabled });
      void persistSetting("autoRuleSelectionEnabled", enabled);
      emitter.emit(settingsEvent.autoRuleSelectionEnabledChanged, { enabled });
    },
    setAutoRuleSelectionModelId: (modelId) => {
      set({ autoRuleSelectionModelId: modelId });
      void persistSetting("autoRuleSelectionModelId", modelId);
      emitter.emit(settingsEvent.autoRuleSelectionModelIdChanged, { modelId });
    },
    setAutoRuleSelectionPrompt: (prompt) => {
      set({ autoRuleSelectionPrompt: prompt });
      void persistSetting("autoRuleSelectionPrompt", prompt);
      emitter.emit(settingsEvent.autoRuleSelectionPromptChanged, { prompt });
    },
    setRunnableBlocksEnabled: (enabled) => {
      set({ runnableBlocksEnabled: enabled });
      void persistSetting("runnableBlocksEnabled", enabled);
      emitter.emit(settingsEvent.runnableBlocksEnabledChanged, { enabled });
    },
    setRunnableBlocksSecurityCheckEnabled: (enabled) => {
      set({ runnableBlocksSecurityCheckEnabled: enabled });
      void persistSetting("runnableBlocksSecurityCheckEnabled", enabled);
      emitter.emit(settingsEvent.runnableBlocksSecurityCheckEnabledChanged, { enabled });
    },
    setRunnableBlocksSecurityModelId: (modelId) => {
      set({ runnableBlocksSecurityModelId: modelId });
      void persistSetting("runnableBlocksSecurityModelId", modelId);
      emitter.emit(settingsEvent.runnableBlocksSecurityModelIdChanged, { modelId });
    },
    setRunnableBlocksSecurityPrompt: (prompt) => {
      set({ runnableBlocksSecurityPrompt: prompt });
      void persistSetting("runnableBlocksSecurityPrompt", prompt);
      emitter.emit(settingsEvent.runnableBlocksSecurityPromptChanged, { prompt });
    },
    
    // Auto Tool Selection Actions
    setAutoToolSelectionEnabled: createToolSelectionSettingAction(
      "autoToolSelectionEnabled",
      (enabled) => emitter.emit(settingsEvent.autoToolSelectionEnabledChanged, { enabled }),
    ),
    setAutoToolSelectionModelId: createToolSelectionSettingAction(
      "autoToolSelectionModelId",
      (modelId) => emitter.emit(settingsEvent.autoToolSelectionModelIdChanged, { modelId }),
    ),
    setAutoToolSelectionPrompt: createToolSelectionSettingAction(
      "autoToolSelectionPrompt",
      (prompt) => emitter.emit(settingsEvent.autoToolSelectionPromptChanged, { prompt }),
    ),
    
    // Text Trigger Actions
    setTextTriggersEnabled: (enabled) => {
      set({ textTriggersEnabled: enabled });
      void persistSetting("textTriggersEnabled", enabled);
      emitter.emit(settingsEvent.textTriggersEnabledChanged, { enabled });
    },
    setTextTriggerDelimiters: (start, end) => {
      set((state) => {
        state.textTriggerStartDelimiter = start;
        state.textTriggerEndDelimiter = end;
      });
      void persistSetting("textTriggerStartDelimiter", start);
      void persistSetting("textTriggerEndDelimiter", end);
      emitter.emit(settingsEvent.textTriggerDelimitersChanged, { start, end });
    },
    
    // Config Sync Actions
    setConfigSyncEnabled: createConfigSyncSettingAction(
      "configSyncEnabled",
      (enabled) => emitter.emit(settingsEvent.configSyncEnabledChanged, { enabled }),
    ),
    setConfigSyncRepoId: createConfigSyncSettingAction(
      "configSyncRepoId",
      (repoId) => emitter.emit(settingsEvent.configSyncRepoIdChanged, { repoId }),
    ),
    setConfigSyncAutoSync: createConfigSyncSettingAction(
      "configSyncAutoSync",
      (enabled) => emitter.emit(settingsEvent.configSyncAutoSyncChanged, { enabled }),
    ),
    setConfigSyncIncludeSettings: createConfigSyncSettingAction(
      "configSyncIncludeSettings",
      (include) => emitter.emit(settingsEvent.configSyncIncludeSettingsChanged, { include }),
    ),
    setConfigSyncIncludePromptTemplates: createConfigSyncSettingAction(
      "configSyncIncludePromptTemplates",
      (include) => emitter.emit(settingsEvent.configSyncIncludePromptTemplatesChanged, { include }),
    ),
    setConfigSyncIncludeRules: createConfigSyncSettingAction(
      "configSyncIncludeRules",
      (include) => emitter.emit(settingsEvent.configSyncIncludeRulesChanged, { include }),
    ),
    setConfigSyncIncludeAgents: createConfigSyncSettingAction(
      "configSyncIncludeAgents",
      (include) => emitter.emit(settingsEvent.configSyncIncludeAgentsChanged, { include }),
    ),
    setConfigSyncIncludeWorkflows: createConfigSyncSettingAction(
      "configSyncIncludeWorkflows",
      (include) => emitter.emit(settingsEvent.configSyncIncludeWorkflowsChanged, { include }),
    ),
    setConfigSyncIncludeMcpServers: createConfigSyncSettingAction(
      "configSyncIncludeMcpServers",
      (include) => emitter.emit(settingsEvent.configSyncIncludeMcpServersChanged, { include }),
    ),
    setConfigSyncLastSyncedAt: createConfigSyncSettingAction(
      "configSyncLastSyncedAt",
      (timestamp) => emitter.emit(settingsEvent.configSyncLastSyncedAtChanged, { timestamp }),
    ),
    setConfigSyncInterval: createConfigSyncSettingAction(
      "configSyncInterval",
      (interval) => emitter.emit(settingsEvent.configSyncIntervalChanged, { interval }),
    ),
    
    // Service URL Actions
    setCorsProxyUrl: (url: string) => {
      const trimmed = url.trim();
      set({ corsProxyUrl: trimmed });
      void persistSetting("corsProxyUrl", trimmed);
      emitter.emit(settingsEvent.corsProxyUrlChanged, { url: trimmed });
    },
    setMarkdownServiceUrl: (url: string) => {
      const trimmed = url.trim();
      set({ markdownServiceUrl: trimmed });
      void persistSetting("markdownServiceUrl", trimmed);
      emitter.emit(settingsEvent.markdownServiceUrlChanged, { url: trimmed });
    },

    loadSettings: async () => {
      try {
        const initialState = get();
        const [themeSettings, autoTitleSettings, toolSelectionSettings, configSyncSettings] =
          await Promise.all([
            SettingsPersistenceService.loadThemeSettings(),
            SettingsPersistenceService.loadAutoTitleSettings(),
            SettingsPersistenceService.loadToolSelectionSettings(),
            SettingsPersistenceService.loadConfigSyncSettings(),
          ]);

        const loadedSettings: Partial<SettingsState> = {
          ...themeSettings,
          ...autoTitleSettings,
          ...toolSelectionSettings,
          ...configSyncSettings,
        };

        const legacyEntries = await Promise.all(
          LEGACY_SETTINGS_KEYS.map(async (key) => [
            key,
            await PersistenceService.loadSetting(key, initialState[key]),
          ] as const),
        );

        for (const [key, value] of legacyEntries) {
          loadedSettings[key] = value;
        }

        set(loadedSettings);
        emitter.emit(settingsEvent.loaded, { settings: get() });
      } catch (error) {
        toast.error("Failed to load settings from the database.", {
          description:
            "Your settings could not be retrieved. Default settings will be used. Please check the console for more details.",
        });
        console.error("Error loading settings:", error);
      }
    },

    resetGeneralSettings: async () => {
      const newSettings = {
        enableAdvancedSettings: DEFAULT_ENABLE_ADVANCED_SETTINGS,
        enableStreamingMarkdown: DEFAULT_ENABLE_STREAMING_MARKDOWN,
        enableStreamingCodeBlockParsing: DEFAULT_ENABLE_STREAMING_CODE_BLOCK_PARSING,
        foldStreamingCodeBlocks: DEFAULT_FOLD_STREAMING_CODE_BLOCKS,
        foldUserMessagesOnCompletion: DEFAULT_FOLD_USER_MESSAGES_ON_COMPLETION,
        streamingRenderFPS: DEFAULT_STREAMING_FPS,
        autoScrollInterval: DEFAULT_AUTO_SCROLL_INTERVAL,
        enableAutoScrollOnStream: DEFAULT_ENABLE_AUTO_SCROLL_ON_STREAM,
      };
      set(newSettings);
      for (const key of Object.keys(newSettings) as (keyof typeof newSettings)[]) {
        await persistSetting(key, newSettings[key] as any);
      }
      toast.success("General settings have been reset to their defaults.");
    },

    resetAssistantSettings: async () => {
      const autoTitleSettings = await SettingsPersistenceService.resetAutoTitleSettings();
      const toolSelectionSettings = await SettingsPersistenceService.resetToolSelectionSettings();
      const newSettings = {
        temperature: DEFAULT_TEMPERATURE,
        maxTokens: DEFAULT_MAX_TOKENS,
        topP: DEFAULT_TOP_P,
        topK: DEFAULT_TOP_K,
        presencePenalty: DEFAULT_PRESENCE_PENALTY,
        frequencyPenalty: DEFAULT_FREQUENCY_PENALTY,
        ...toolSelectionSettings,
        ...autoTitleSettings,
        forkCompactPrompt: DEFAULT_FORK_COMPACT_PROMPT,
        forkCompactModelId: DEFAULT_FORK_COMPACT_MODEL_ID,
        autoRuleSelectionEnabled: DEFAULT_AUTO_RULE_SELECTION_ENABLED,
        autoRuleSelectionModelId: DEFAULT_AUTO_RULE_SELECTION_MODEL_ID,
        autoRuleSelectionPrompt: DEFAULT_AUTO_RULE_SELECTION_PROMPT,
        runnableBlocksEnabled: DEFAULT_RUNNABLE_BLOCKS_ENABLED,
        runnableBlocksSecurityCheckEnabled: DEFAULT_RUNNABLE_BLOCKS_SECURITY_CHECK_ENABLED,
        runnableBlocksSecurityModelId: DEFAULT_RUNNABLE_BLOCKS_SECURITY_MODEL_ID,
        runnableBlocksSecurityPrompt: DEFAULT_RUNNABLE_BLOCKS_SECURITY_PROMPT,
      };
      set(newSettings);
      for (const key of [
        "temperature",
        "maxTokens",
        "topP",
        "topK",
        "presencePenalty",
        "frequencyPenalty",
        "forkCompactPrompt",
        "forkCompactModelId",
        "autoRuleSelectionEnabled",
        "autoRuleSelectionModelId",
        "autoRuleSelectionPrompt",
        "runnableBlocksEnabled",
        "runnableBlocksSecurityCheckEnabled",
        "runnableBlocksSecurityModelId",
        "runnableBlocksSecurityPrompt",
      ] as const) {
        await persistSetting(key, newSettings[key]);
      }
      emitSettingsChangedEntries(autoTitleSettings);
      emitSettingsChangedEntries(toolSelectionSettings);
      toast.success("Assistant settings have been reset to their defaults.");
    },

    resetThemeSettings: async () => {
      const newSettings = await SettingsPersistenceService.resetThemeSettings();
      set(newSettings);
      emitSettingsChangedEntries(newSettings);
      toast.success("Theme settings have been reset to their defaults.");
    },

    getRegisteredActionHandlers: (): RegisteredActionHandler[] => {
      const actions = get();

      const storeId = "settingsStore";
      return [
        {
          eventName: settingsEvent.setThemeRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setThemeRequest]) => actions.setTheme(p.theme),
          storeId,
        },
        {
          eventName: settingsEvent.setGlobalSystemPromptRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setGlobalSystemPromptRequest]) =>
            actions.setGlobalSystemPrompt(p.prompt),
          storeId,
        },
        {
          eventName: settingsEvent.setTemperatureRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setTemperatureRequest]) =>
            actions.setTemperature(p.value),
          storeId,
        },
        {
          eventName: settingsEvent.setMaxTokensRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setMaxTokensRequest]) =>
            actions.setMaxTokens(p.value),
          storeId,
        },
        {
          eventName: settingsEvent.setTopPRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setTopPRequest]) => actions.setTopP(p.value),
          storeId,
        },
        {
          eventName: settingsEvent.setTopKRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setTopKRequest]) => actions.setTopK(p.value),
          storeId,
        },
        {
          eventName: settingsEvent.setPresencePenaltyRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setPresencePenaltyRequest]) =>
            actions.setPresencePenalty(p.value),
          storeId,
        },
        {
          eventName: settingsEvent.setFrequencyPenaltyRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setFrequencyPenaltyRequest]) =>
            actions.setFrequencyPenalty(p.value),
          storeId,
        },
        {
          eventName: settingsEvent.setEnableAdvancedSettingsRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setEnableAdvancedSettingsRequest]) =>
            actions.setEnableAdvancedSettings(p.enabled),
          storeId,
        },
        {
          eventName: settingsEvent.setEnableStreamingMarkdownRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setEnableStreamingMarkdownRequest]) =>
            actions.setEnableStreamingMarkdown(p.enabled),
          storeId,
        },
        {
          eventName: settingsEvent.setEnableStreamingCodeBlockParsingRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setEnableStreamingCodeBlockParsingRequest]) =>
            actions.setEnableStreamingCodeBlockParsing(p.enabled),
          storeId,
        },
        {
          eventName: settingsEvent.setFoldStreamingCodeBlocksRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setFoldStreamingCodeBlocksRequest]) =>
            actions.setFoldStreamingCodeBlocks(p.fold),
          storeId,
        },
        {
          eventName: settingsEvent.setFoldUserMessagesOnCompletionRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setFoldUserMessagesOnCompletionRequest]) =>
            actions.setFoldUserMessagesOnCompletion(p.fold),
          storeId,
        },
        {
          eventName: settingsEvent.setStreamingRenderFpsRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setStreamingRenderFpsRequest]) =>
            actions.setStreamingRenderFPS(p.fps),
          storeId,
        },
        {
          eventName: settingsEvent.setGitUserNameRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setGitUserNameRequest]) =>
            actions.setGitUserName(p.name),
          storeId,
        },
        {
          eventName: settingsEvent.setGitUserEmailRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setGitUserEmailRequest]) =>
            actions.setGitUserEmail(p.email),
          storeId,
        },
        {
          eventName: settingsEvent.setGitGlobalPatRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setGitGlobalPatRequest]) =>
            actions.setGitGlobalPat(p.pat),
          storeId,
        },
        {
          eventName: settingsEvent.setToolMaxStepsRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setToolMaxStepsRequest]) =>
            actions.setToolMaxSteps(p.steps),
          storeId,
        },
        {
          eventName: settingsEvent.setPrismThemeUrlRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setPrismThemeUrlRequest]) =>
            actions.setPrismThemeUrl(p.url),
          storeId,
        },
        {
          eventName: settingsEvent.setAutoTitleEnabledRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setAutoTitleEnabledRequest]) =>
            actions.setAutoTitleEnabled(p.enabled),
          storeId,
        },
        {
          eventName: settingsEvent.setAutoTitleAlwaysOnRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setAutoTitleAlwaysOnRequest]) =>
            actions.setAutoTitleAlwaysOn(p.enabled),
          storeId,
        },
        {
          eventName: settingsEvent.setAutoTitleModelIdRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setAutoTitleModelIdRequest]) =>
            actions.setAutoTitleModelId(p.modelId),
          storeId,
        },
        {
          eventName: settingsEvent.setAutoTitlePromptMaxLengthRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setAutoTitlePromptMaxLengthRequest]) =>
            actions.setAutoTitlePromptMaxLength(p.length),
          storeId,
        },
        {
          eventName: settingsEvent.setAutoTitleIncludeFilesRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setAutoTitleIncludeFilesRequest]) =>
            actions.setAutoTitleIncludeFiles(p.include),
          storeId,
        },
        {
          eventName: settingsEvent.setAutoTitleIncludeRulesRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setAutoTitleIncludeRulesRequest]) =>
            actions.setAutoTitleIncludeRules(p.include),
          storeId,
        },
        {
          eventName: settingsEvent.setCustomFontFamilyRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setCustomFontFamilyRequest]) =>
            actions.setCustomFontFamily(p.fontFamily),
          storeId,
        },
        {
          eventName: settingsEvent.setCustomFontSizeRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setCustomFontSizeRequest]) =>
            actions.setCustomFontSize(p.fontSize),
          storeId,
        },
        {
          eventName: settingsEvent.setChatMaxWidthRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setChatMaxWidthRequest]) =>
            actions.setChatMaxWidth(p.maxWidth),
          storeId,
        },
        {
          eventName: settingsEvent.setCustomThemeColorsRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setCustomThemeColorsRequest]) =>
            actions.setCustomThemeColors(p.colors),
          storeId,
        },
        {
          eventName: settingsEvent.setCustomThemeColorRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setCustomThemeColorRequest]) =>
            actions.setCustomThemeColor(p.colorKey, p.value),
          storeId,
        },
        {
          eventName: settingsEvent.setAutoScrollIntervalRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setAutoScrollIntervalRequest]) =>
            actions.setAutoScrollInterval(p.interval),
          storeId,
        },
        {
          eventName: settingsEvent.setEnableAutoScrollOnStreamRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setEnableAutoScrollOnStreamRequest]) =>
            actions.setEnableAutoScrollOnStream(p.enabled),
          storeId,
        },
        {
          eventName: settingsEvent.setAutoSyncOnStreamCompleteRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setAutoSyncOnStreamCompleteRequest]) =>
            actions.setAutoSyncOnStreamComplete(p.enabled),
          storeId,
        },
        {
          eventName: settingsEvent.setAutoInitializeReposOnStartupRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setAutoInitializeReposOnStartupRequest]) =>
            actions.setAutoInitializeReposOnStartup(p.enabled),
          storeId,
        },
        {
          eventName: settingsEvent.setControlRuleAlwaysOnRequest,
          handler: (payload) => actions.setControlRuleAlwaysOn(payload.ruleId, payload.alwaysOn),
          storeId,
        },
        {
          eventName: settingsEvent.setAutoRuleSelectionEnabledRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setAutoRuleSelectionEnabledRequest]) =>
            actions.setAutoRuleSelectionEnabled(p.enabled),
          storeId,
        },
        {
          eventName: settingsEvent.setAutoRuleSelectionModelIdRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setAutoRuleSelectionModelIdRequest]) =>
            actions.setAutoRuleSelectionModelId(p.modelId),
          storeId,
        },
        {
          eventName: settingsEvent.setAutoRuleSelectionPromptRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setAutoRuleSelectionPromptRequest]) =>
            actions.setAutoRuleSelectionPrompt(p.prompt),
          storeId,
        },
        {
          eventName: settingsEvent.setRunnableBlocksEnabledRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setRunnableBlocksEnabledRequest]) =>
            actions.setRunnableBlocksEnabled(p.enabled),
          storeId,
        },
        {
          eventName: settingsEvent.setRunnableBlocksSecurityCheckEnabledRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setRunnableBlocksSecurityCheckEnabledRequest]) =>
            actions.setRunnableBlocksSecurityCheckEnabled(p.enabled),
          storeId,
        },
        {
          eventName: settingsEvent.setRunnableBlocksSecurityModelIdRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setRunnableBlocksSecurityModelIdRequest]) =>
            actions.setRunnableBlocksSecurityModelId(p.modelId),
          storeId,
        },
        {
          eventName: settingsEvent.setRunnableBlocksSecurityPromptRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setRunnableBlocksSecurityPromptRequest]) =>
            actions.setRunnableBlocksSecurityPrompt(p.prompt),
          storeId,
        },
        {
          eventName: settingsEvent.setAutoToolSelectionEnabledRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setAutoToolSelectionEnabledRequest]) =>
            actions.setAutoToolSelectionEnabled(p.enabled),
          storeId,
        },
        {
          eventName: settingsEvent.setAutoToolSelectionModelIdRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setAutoToolSelectionModelIdRequest]) =>
            actions.setAutoToolSelectionModelId(p.modelId),
          storeId,
        },
        {
          eventName: settingsEvent.setAutoToolSelectionPromptRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setAutoToolSelectionPromptRequest]) =>
            actions.setAutoToolSelectionPrompt(p.prompt),
          storeId,
        },
        {
          eventName: settingsEvent.setTextTriggersEnabledRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setTextTriggersEnabledRequest]) =>
            actions.setTextTriggersEnabled(p.enabled),
          storeId,
        },
        {
          eventName: settingsEvent.setTextTriggerDelimitersRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setTextTriggerDelimitersRequest]) =>
            actions.setTextTriggerDelimiters(p.start, p.end),
          storeId,
        },
        {
          eventName: settingsEvent.loadSettingsRequest,
          handler: () => actions.loadSettings(),
          storeId,
        },
        {
          eventName: settingsEvent.resetGeneralSettingsRequest,
          handler: () => actions.resetGeneralSettings(),
          storeId,
        },
        {
          eventName: settingsEvent.resetAssistantSettingsRequest,
          handler: () => actions.resetAssistantSettings(),
          storeId,
        },
        {
          eventName: settingsEvent.resetThemeSettingsRequest,
          handler: () => actions.resetThemeSettings(),
          storeId,
        },
        {
          eventName: settingsEvent.setConfigSyncEnabledRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setConfigSyncEnabledRequest]) =>
            actions.setConfigSyncEnabled(p.enabled),
          storeId,
        },
        {
          eventName: settingsEvent.setConfigSyncRepoIdRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setConfigSyncRepoIdRequest]) =>
            actions.setConfigSyncRepoId(p.repoId),
          storeId,
        },
        {
          eventName: settingsEvent.setConfigSyncAutoSyncRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setConfigSyncAutoSyncRequest]) =>
            actions.setConfigSyncAutoSync(p.enabled),
          storeId,
        },
        {
          eventName: settingsEvent.setConfigSyncIntervalRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setConfigSyncIntervalRequest]) =>
            actions.setConfigSyncInterval(p.interval),
          storeId,
        },
        {
          eventName: settingsEvent.setCorsProxyUrlRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setCorsProxyUrlRequest]) =>
            actions.setCorsProxyUrl(p.url),
          storeId,
        },
        {
          eventName: settingsEvent.setMarkdownServiceUrlRequest,
          handler: (p: SettingsEventPayloads[typeof settingsEvent.setMarkdownServiceUrlRequest]) =>
            actions.setMarkdownServiceUrl(p.url),
          storeId,
        },
      ];
    },
    });
  })
);
