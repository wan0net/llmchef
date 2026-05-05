import { PersistenceService } from "@/services/persistence.service";
import type {
  AutoTitleSettings,
  ConfigSyncSettings,
  CustomThemeColors,
  ThemeSettings,
  ToolSelectionSettings,
} from "@/types/llmchef/settings";
import type { Theme } from "@/types/llmchef/common";

export const DEFAULT_THEME: Theme = "link42Dark";
export const DEFAULT_PRISM_THEME_URL = null;
export const DEFAULT_CUSTOM_FONT_FAMILY = null;
export const DEFAULT_CUSTOM_FONT_SIZE = 16;
export const DEFAULT_CHAT_MAX_WIDTH = "max-w-7xl";
export const DEFAULT_CUSTOM_THEME_COLORS: CustomThemeColors | null = null;

export const DEFAULT_AUTO_TITLE_ENABLED = true;
export const DEFAULT_AUTO_TITLE_ALWAYS_ON = false;
export const DEFAULT_AUTO_TITLE_MODEL_ID = null;
export const DEFAULT_AUTO_TITLE_PROMPT_MAX_LENGTH = 768;
export const DEFAULT_AUTO_TITLE_INCLUDE_FILES = false;
export const DEFAULT_AUTO_TITLE_INCLUDE_RULES = false;

export const DEFAULT_TOOL_MAX_STEPS = 5;
export const DEFAULT_AUTO_TOOL_SELECTION_ENABLED = false;
export const DEFAULT_AUTO_TOOL_SELECTION_MODEL_ID = null;
export const DEFAULT_AUTO_TOOL_SELECTION_PROMPT =
  "Analyze the following user prompt and the list of available tools. Select the most relevant tools that would help accomplish the user's task. Respond with ONLY a JSON string array of the selected tool names, for example: [\"tool1\", \"tool2\"]. Do not include any other text, explanation, or markdown formatting.\n\nUSER PROMPT:\n{{prompt}}\n\nAVAILABLE TOOLS:\n{{tools}}";

export const DEFAULT_CONFIG_SYNC_ENABLED = false;
export const DEFAULT_CONFIG_SYNC_REPO_ID = null;
export const DEFAULT_CONFIG_SYNC_AUTO_SYNC = false;
export const DEFAULT_CONFIG_SYNC_INCLUDE_SETTINGS = true;
export const DEFAULT_CONFIG_SYNC_INCLUDE_RULES = true;
export const DEFAULT_CONFIG_SYNC_INCLUDE_PROMPT_TEMPLATES = true;
export const DEFAULT_CONFIG_SYNC_INCLUDE_AGENTS = true;
export const DEFAULT_CONFIG_SYNC_INCLUDE_WORKFLOWS = true;
export const DEFAULT_CONFIG_SYNC_INCLUDE_MCP_SERVERS = true;
export const DEFAULT_CONFIG_SYNC_LAST_SYNCED_AT = null;
export const DEFAULT_CONFIG_SYNC_INTERVAL = 3600000;

const THEME_SETTING_KEYS = [
  "theme",
  "prismThemeUrl",
  "customFontFamily",
  "customFontSize",
  "chatMaxWidth",
  "customThemeColors",
] as const satisfies readonly (keyof ThemeSettings)[];

const AUTO_TITLE_SETTING_KEYS = [
  "autoTitleEnabled",
  "autoTitleAlwaysOn",
  "autoTitleModelId",
  "autoTitlePromptMaxLength",
  "autoTitleIncludeFiles",
  "autoTitleIncludeRules",
] as const satisfies readonly (keyof AutoTitleSettings)[];

const TOOL_SELECTION_SETTING_KEYS = [
  "toolMaxSteps",
  "autoToolSelectionEnabled",
  "autoToolSelectionModelId",
  "autoToolSelectionPrompt",
] as const satisfies readonly (keyof ToolSelectionSettings)[];

const CONFIG_SYNC_SETTING_KEYS = [
  "configSyncEnabled",
  "configSyncRepoId",
  "configSyncAutoSync",
  "configSyncIncludeSettings",
  "configSyncIncludeRules",
  "configSyncIncludePromptTemplates",
  "configSyncIncludeAgents",
  "configSyncIncludeWorkflows",
  "configSyncIncludeMcpServers",
  "configSyncLastSyncedAt",
  "configSyncInterval",
] as const satisfies readonly (keyof ConfigSyncSettings)[];

const loadSettingsSlice = async <T extends Record<string, unknown>>(
  defaults: T,
): Promise<T> => {
  const entries = await Promise.all(
    Object.entries(defaults).map(async ([key, defaultValue]) => {
      const value = await PersistenceService.loadSetting(key, defaultValue);
      return [key, value] as const;
    }),
  );

  return Object.fromEntries(entries) as T;
};

const saveSettingsSlice = async <T extends Record<string, unknown>>(
  keys: readonly (keyof T)[],
  partial: Partial<T>,
): Promise<void> => {
  await Promise.all(
    keys.flatMap((key) => {
      const value = partial[key];
      if (value === undefined || !(key in partial)) {
        return [];
      }

      return [PersistenceService.saveSetting(key as string, value)];
    }),
  );
};

const normalizeCustomThemeColors = (
  value: CustomThemeColors | null | undefined,
): CustomThemeColors | null => {
  if (value == null) {
    return null;
  }

  return typeof value === "object" ? { ...value } : null;
};

export const createDefaultThemeSettings = (): ThemeSettings => ({
  theme: DEFAULT_THEME,
  prismThemeUrl: DEFAULT_PRISM_THEME_URL,
  customFontFamily: DEFAULT_CUSTOM_FONT_FAMILY,
  customFontSize: DEFAULT_CUSTOM_FONT_SIZE,
  chatMaxWidth: DEFAULT_CHAT_MAX_WIDTH,
  customThemeColors: DEFAULT_CUSTOM_THEME_COLORS,
});

export const createDefaultAutoTitleSettings = (): AutoTitleSettings => ({
  autoTitleEnabled: DEFAULT_AUTO_TITLE_ENABLED,
  autoTitleAlwaysOn: DEFAULT_AUTO_TITLE_ALWAYS_ON,
  autoTitleModelId: DEFAULT_AUTO_TITLE_MODEL_ID,
  autoTitlePromptMaxLength: DEFAULT_AUTO_TITLE_PROMPT_MAX_LENGTH,
  autoTitleIncludeFiles: DEFAULT_AUTO_TITLE_INCLUDE_FILES,
  autoTitleIncludeRules: DEFAULT_AUTO_TITLE_INCLUDE_RULES,
});

export const createDefaultToolSelectionSettings = (): ToolSelectionSettings => ({
  toolMaxSteps: DEFAULT_TOOL_MAX_STEPS,
  autoToolSelectionEnabled: DEFAULT_AUTO_TOOL_SELECTION_ENABLED,
  autoToolSelectionModelId: DEFAULT_AUTO_TOOL_SELECTION_MODEL_ID,
  autoToolSelectionPrompt: DEFAULT_AUTO_TOOL_SELECTION_PROMPT,
});

export const createDefaultConfigSyncSettings = (): ConfigSyncSettings => ({
  configSyncEnabled: DEFAULT_CONFIG_SYNC_ENABLED,
  configSyncRepoId: DEFAULT_CONFIG_SYNC_REPO_ID,
  configSyncAutoSync: DEFAULT_CONFIG_SYNC_AUTO_SYNC,
  configSyncIncludeSettings: DEFAULT_CONFIG_SYNC_INCLUDE_SETTINGS,
  configSyncIncludeRules: DEFAULT_CONFIG_SYNC_INCLUDE_RULES,
  configSyncIncludePromptTemplates: DEFAULT_CONFIG_SYNC_INCLUDE_PROMPT_TEMPLATES,
  configSyncIncludeAgents: DEFAULT_CONFIG_SYNC_INCLUDE_AGENTS,
  configSyncIncludeWorkflows: DEFAULT_CONFIG_SYNC_INCLUDE_WORKFLOWS,
  configSyncIncludeMcpServers: DEFAULT_CONFIG_SYNC_INCLUDE_MCP_SERVERS,
  configSyncLastSyncedAt: DEFAULT_CONFIG_SYNC_LAST_SYNCED_AT,
  configSyncInterval: DEFAULT_CONFIG_SYNC_INTERVAL,
});

export class SettingsPersistenceService {
  static async saveThemeSettings(partial: Partial<ThemeSettings>): Promise<void> {
    const normalizedPartial =
      "customThemeColors" in partial
        ? {
            ...partial,
            customThemeColors: normalizeCustomThemeColors(partial.customThemeColors),
          }
        : partial;

    await saveSettingsSlice(THEME_SETTING_KEYS, normalizedPartial);
  }

  static async loadThemeSettings(): Promise<ThemeSettings> {
    const settings = await loadSettingsSlice(createDefaultThemeSettings());
    return {
      ...settings,
      customThemeColors: normalizeCustomThemeColors(settings.customThemeColors),
    };
  }

  static async resetThemeSettings(): Promise<ThemeSettings> {
    const defaults = createDefaultThemeSettings();
    await this.saveThemeSettings(defaults);
    return defaults;
  }

  static async saveAutoTitleSettings(
    partial: Partial<AutoTitleSettings>,
  ): Promise<void> {
    await saveSettingsSlice(AUTO_TITLE_SETTING_KEYS, partial);
  }

  static async loadAutoTitleSettings(): Promise<AutoTitleSettings> {
    return loadSettingsSlice(createDefaultAutoTitleSettings());
  }

  static async resetAutoTitleSettings(): Promise<AutoTitleSettings> {
    const defaults = createDefaultAutoTitleSettings();
    await this.saveAutoTitleSettings(defaults);
    return defaults;
  }

  static async saveToolSelectionSettings(
    partial: Partial<ToolSelectionSettings>,
  ): Promise<void> {
    await saveSettingsSlice(TOOL_SELECTION_SETTING_KEYS, partial);
  }

  static async loadToolSelectionSettings(): Promise<ToolSelectionSettings> {
    return loadSettingsSlice(createDefaultToolSelectionSettings());
  }

  static async resetToolSelectionSettings(): Promise<ToolSelectionSettings> {
    const defaults = createDefaultToolSelectionSettings();
    await this.saveToolSelectionSettings(defaults);
    return defaults;
  }

  static async saveConfigSyncSettings(
    partial: Partial<ConfigSyncSettings>,
  ): Promise<void> {
    await saveSettingsSlice(CONFIG_SYNC_SETTING_KEYS, partial);
  }

  static async loadConfigSyncSettings(): Promise<ConfigSyncSettings> {
    return loadSettingsSlice(createDefaultConfigSyncSettings());
  }

  static async resetConfigSyncSettings(): Promise<ConfigSyncSettings> {
    const defaults = createDefaultConfigSyncSettings();
    await this.saveConfigSyncSettings(defaults);
    return defaults;
  }
}
