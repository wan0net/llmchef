import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loadSetting: vi.fn(),
  saveSetting: vi.fn(),
}));

vi.mock("./persistence.service", () => ({
  PersistenceService: {
    loadSetting: mocks.loadSetting,
    saveSetting: mocks.saveSetting,
  },
}));

import {
  createDefaultAutoTitleSettings,
  createDefaultConfigSyncSettings,
  createDefaultThemeSettings,
  createDefaultToolSelectionSettings,
  DEFAULT_AUTO_TITLE_PROMPT_MAX_LENGTH,
  DEFAULT_CONFIG_SYNC_INTERVAL,
  SettingsPersistenceService,
} from "./settings-persistence.service";

describe("settings persistence service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates the expected defaults for the extracted settings slices", () => {
    expect(createDefaultThemeSettings()).toMatchObject({
      theme: "link42Dark",
      prismThemeUrl: null,
      customFontFamily: null,
      customFontSize: 16,
      chatMaxWidth: "max-w-7xl",
      customThemeColors: null,
    });

    expect(createDefaultAutoTitleSettings()).toMatchObject({
      autoTitleEnabled: true,
      autoTitleAlwaysOn: false,
      autoTitleModelId: null,
      autoTitlePromptMaxLength: DEFAULT_AUTO_TITLE_PROMPT_MAX_LENGTH,
      autoTitleIncludeFiles: false,
      autoTitleIncludeRules: false,
    });

    expect(createDefaultToolSelectionSettings()).toMatchObject({
      toolMaxSteps: 5,
      autoToolSelectionEnabled: false,
      autoToolSelectionModelId: null,
    });

    expect(createDefaultConfigSyncSettings()).toMatchObject({
      configSyncEnabled: false,
      configSyncRepoId: null,
      configSyncAutoSync: false,
      configSyncIncludeSettings: true,
      configSyncIncludeRules: true,
      configSyncIncludePromptTemplates: true,
      configSyncIncludeAgents: true,
      configSyncIncludeWorkflows: true,
      configSyncIncludeMcpServers: true,
      configSyncLastSyncedAt: null,
      configSyncInterval: DEFAULT_CONFIG_SYNC_INTERVAL,
    });
  });

  it("loads defaults for every slice when nothing is persisted", async () => {
    mocks.loadSetting.mockImplementation(async (_key: string, defaultValue: unknown) => defaultValue);

    const [theme, autoTitle, toolSelection, configSync] = await Promise.all([
      SettingsPersistenceService.loadThemeSettings(),
      SettingsPersistenceService.loadAutoTitleSettings(),
      SettingsPersistenceService.loadToolSelectionSettings(),
      SettingsPersistenceService.loadConfigSyncSettings(),
    ]);

    expect(theme).toEqual(createDefaultThemeSettings());
    expect(autoTitle).toEqual(createDefaultAutoTitleSettings());
    expect(toolSelection).toEqual(createDefaultToolSelectionSettings());
    expect(configSync).toEqual(createDefaultConfigSyncSettings());
  });

  it("rehydrates persisted values for every slice", async () => {
    mocks.loadSetting.mockImplementation(async (key: string, defaultValue: unknown) => {
      const persisted: Record<string, unknown> = {
        theme: "light",
        prismThemeUrl: "https://themes.example/prism.css",
        customFontFamily: "Inter",
        customFontSize: 18,
        chatMaxWidth: "max-w-5xl",
        customThemeColors: { background: "#101010", foreground: "#fafafa" },
        autoTitleEnabled: false,
        autoTitleAlwaysOn: true,
        autoTitleModelId: "title-model",
        autoTitlePromptMaxLength: 1536,
        autoTitleIncludeFiles: true,
        autoTitleIncludeRules: true,
        toolMaxSteps: 9,
        autoToolSelectionEnabled: true,
        autoToolSelectionModelId: "tool-model",
        autoToolSelectionPrompt: "pick tools",
        configSyncEnabled: true,
        configSyncRepoId: "repo-123",
        configSyncAutoSync: true,
        configSyncIncludeSettings: false,
        configSyncIncludeRules: false,
        configSyncIncludePromptTemplates: false,
        configSyncIncludeAgents: false,
        configSyncIncludeWorkflows: false,
        configSyncIncludeMcpServers: false,
        configSyncLastSyncedAt: "2026-05-01T00:00:00.000Z",
        configSyncInterval: 900000,
      };

      return key in persisted ? persisted[key] : defaultValue;
    });

    expect(await SettingsPersistenceService.loadThemeSettings()).toEqual({
      theme: "light",
      prismThemeUrl: "https://themes.example/prism.css",
      customFontFamily: "Inter",
      customFontSize: 18,
      chatMaxWidth: "max-w-5xl",
      customThemeColors: { background: "#101010", foreground: "#fafafa" },
    });

    expect(await SettingsPersistenceService.loadAutoTitleSettings()).toEqual({
      autoTitleEnabled: false,
      autoTitleAlwaysOn: true,
      autoTitleModelId: "title-model",
      autoTitlePromptMaxLength: 1536,
      autoTitleIncludeFiles: true,
      autoTitleIncludeRules: true,
    });

    expect(await SettingsPersistenceService.loadToolSelectionSettings()).toEqual({
      toolMaxSteps: 9,
      autoToolSelectionEnabled: true,
      autoToolSelectionModelId: "tool-model",
      autoToolSelectionPrompt: "pick tools",
    });

    expect(await SettingsPersistenceService.loadConfigSyncSettings()).toEqual({
      configSyncEnabled: true,
      configSyncRepoId: "repo-123",
      configSyncAutoSync: true,
      configSyncIncludeSettings: false,
      configSyncIncludeRules: false,
      configSyncIncludePromptTemplates: false,
      configSyncIncludeAgents: false,
      configSyncIncludeWorkflows: false,
      configSyncIncludeMcpServers: false,
      configSyncLastSyncedAt: "2026-05-01T00:00:00.000Z",
      configSyncInterval: 900000,
    });
  });

  it("normalizes custom theme colors for null and partial persisted values", async () => {
    mocks.loadSetting.mockImplementation(async (key: string, defaultValue: unknown) => {
      if (key === "customThemeColors") {
        return { primary: "#ff0000" };
      }
      return defaultValue;
    });

    await expect(SettingsPersistenceService.loadThemeSettings()).resolves.toMatchObject({
      customThemeColors: { primary: "#ff0000" },
    });

    mocks.loadSetting.mockImplementation(async (key: string, defaultValue: unknown) => {
      if (key === "customThemeColors") {
        return null;
      }
      return defaultValue;
    });

    await expect(SettingsPersistenceService.loadThemeSettings()).resolves.toMatchObject({
      customThemeColors: null,
    });
  });

  it("resets slices back to defaults and persists the expected keys", async () => {
    mocks.saveSetting.mockResolvedValue(undefined);

    const theme = await SettingsPersistenceService.resetThemeSettings();
    const autoTitle = await SettingsPersistenceService.resetAutoTitleSettings();
    const toolSelection = await SettingsPersistenceService.resetToolSelectionSettings();
    const configSync = await SettingsPersistenceService.resetConfigSyncSettings();

    expect(theme).toEqual(createDefaultThemeSettings());
    expect(autoTitle).toEqual(createDefaultAutoTitleSettings());
    expect(toolSelection).toEqual(createDefaultToolSelectionSettings());
    expect(configSync).toEqual(createDefaultConfigSyncSettings());
    expect(mocks.saveSetting).toHaveBeenCalledTimes(27);
  });

  it("saves partial slice updates without dropping null values", async () => {
    mocks.saveSetting.mockResolvedValue(undefined);

    await SettingsPersistenceService.saveThemeSettings({
      prismThemeUrl: null,
      customThemeColors: { accent: "#00ff00" },
    });
    await SettingsPersistenceService.saveAutoTitleSettings({ autoTitleModelId: null });
    await SettingsPersistenceService.saveToolSelectionSettings({ toolMaxSteps: 12 });
    await SettingsPersistenceService.saveConfigSyncSettings({
      configSyncLastSyncedAt: null,
      configSyncInterval: DEFAULT_CONFIG_SYNC_INTERVAL,
    });

    expect(mocks.saveSetting).toHaveBeenCalledWith("prismThemeUrl", null);
    expect(mocks.saveSetting).toHaveBeenCalledWith("customThemeColors", {
      accent: "#00ff00",
    });
    expect(mocks.saveSetting).toHaveBeenCalledWith("autoTitleModelId", null);
    expect(mocks.saveSetting).toHaveBeenCalledWith("toolMaxSteps", 12);
    expect(mocks.saveSetting).toHaveBeenCalledWith("configSyncLastSyncedAt", null);
    expect(mocks.saveSetting).toHaveBeenCalledWith(
      "configSyncInterval",
      DEFAULT_CONFIG_SYNC_INTERVAL,
    );
  });
});
