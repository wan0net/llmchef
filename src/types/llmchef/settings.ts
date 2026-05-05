import type { Theme } from "@/types/llmchef/common";

export interface CustomThemeColors {
  background?: string;
  foreground?: string;
  card?: string;
  cardForeground?: string;
  popover?: string;
  popoverForeground?: string;
  primary?: string;
  primaryForeground?: string;
  secondary?: string;
  secondaryForeground?: string;
  muted?: string;
  mutedForeground?: string;
  accent?: string;
  accentForeground?: string;
  destructive?: string;
  destructiveForeground?: string;
  border?: string;
  input?: string;
  ring?: string;
  sidebar?: string;
  sidebarForeground?: string;
  sidebarPrimary?: string;
  sidebarPrimaryForeground?: string;
  sidebarAccent?: string;
  sidebarAccentForeground?: string;
  sidebarBorder?: string;
  sidebarRing?: string;
  chart1?: string;
  chart2?: string;
  chart3?: string;
  chart4?: string;
  chart5?: string;
}

export interface ThemeSettings {
  theme: Theme;
  prismThemeUrl: string | null;
  customFontFamily: string | null;
  customFontSize: number | null;
  chatMaxWidth: string | null;
  customThemeColors: CustomThemeColors | null;
}

export interface AutoTitleSettings {
  autoTitleEnabled: boolean;
  autoTitleAlwaysOn: boolean;
  autoTitleModelId: string | null;
  autoTitlePromptMaxLength: number;
  autoTitleIncludeFiles: boolean;
  autoTitleIncludeRules: boolean;
}

export interface ToolSelectionSettings {
  toolMaxSteps: number;
  autoToolSelectionEnabled: boolean;
  autoToolSelectionModelId: string | null;
  autoToolSelectionPrompt: string | null;
}

export interface ConfigSyncSettings {
  configSyncEnabled: boolean;
  configSyncRepoId: string | null;
  configSyncAutoSync: boolean;
  configSyncIncludeSettings: boolean;
  configSyncIncludeRules: boolean;
  configSyncIncludePromptTemplates: boolean;
  configSyncIncludeAgents: boolean;
  configSyncIncludeWorkflows: boolean;
  configSyncIncludeMcpServers: boolean;
  configSyncLastSyncedAt: string | null;
  configSyncInterval: number;
}

export interface SettingsState
  extends ThemeSettings,
    AutoTitleSettings,
    ToolSelectionSettings,
    ConfigSyncSettings {
  globalSystemPrompt: string | null;
  temperature: number | null;
  maxTokens: number | null;
  topP: number | null;
  topK: number | null;
  presencePenalty: number | null;
  frequencyPenalty: number | null;
  enableAdvancedSettings: boolean;
  enableStreamingMarkdown: boolean;
  enableStreamingCodeBlockParsing: boolean;
  foldStreamingCodeBlocks: boolean;
  foldUserMessagesOnCompletion: boolean;
  streamingRenderFPS: number;
  gitUserName: string | null;
  gitUserEmail: string | null;
  gitGlobalPat: string | null;
  forkCompactPrompt: string | null;
  forkCompactModelId: string | null;
  autoScrollInterval: number;
  enableAutoScrollOnStream: boolean;
  autoSyncOnStreamComplete: boolean;
  autoInitializeReposOnStartup: boolean;
  controlRuleAlwaysOn: Record<string, boolean>;
  autoRuleSelectionEnabled: boolean;
  autoRuleSelectionModelId: string | null;
  autoRuleSelectionPrompt: string | null;
  runnableBlocksEnabled: boolean;
  runnableBlocksSecurityCheckEnabled: boolean;
  runnableBlocksSecurityModelId: string | null;
  runnableBlocksSecurityPrompt: string | null;
  textTriggersEnabled: boolean;
  textTriggerStartDelimiter: string;
  textTriggerEndDelimiter: string;
  corsProxyUrl: string;
  markdownServiceUrl: string;
}
