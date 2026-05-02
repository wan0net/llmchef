import type { ControlModuleConstructor } from "@/types/llmchef/control";
import { ConversationListControlModule } from "@/controls/modules/ConversationListControlModule";
import { SettingsControlModule } from "@/controls/modules/SettingsControlModule";
import { SidebarToggleControlModule } from "@/controls/modules/SidebarToggleControlModule";
import { ParameterControlModule } from "@/controls/modules/ParameterControlModule";
import { FileControlModule } from "@/controls/modules/FileControlModule";
import { VfsControlModule } from "@/controls/modules/VfsControlModule";
import { GitSyncControlModule } from "@/controls/modules/GitSyncControlModule";
import { ManualSyncSidebarControlModule } from "@/controls/modules/ManualSyncSidebarControlModule";
import { VfsToolsModule } from "@/controls/modules/VfsToolsModule";
import { GitToolsModule } from "@/controls/modules/GitToolsModule";
import { McpToolsModule } from "@/controls/modules/McpToolsModule";
import { ToolSelectorControlModule } from "@/controls/modules/ToolSelectorControlModule";
import { TextTriggerControlModule } from "@/controls/modules/TextTriggerControlModule";
import { ProjectSettingsControlModule } from "@/controls/modules/ProjectSettingsControlModule";
import { PWAControlModule } from "@/controls/modules/PWAControlModule";
import { GlobalModelSelectorModule } from "@/controls/modules/GlobalModelSelectorModule";
import { SystemPromptControlModule } from "@/controls/modules/SystemPromptControlModule";
import { StructuredOutputControlModule } from "@/controls/modules/StructuredOutputControlModule";
import { UsageDisplayControlModule } from "@/controls/modules/UsageDisplayControlModule";
import { UsageDashboardModule } from "@/controls/modules/UsageDashboardModule";
import { ReasoningControlModule } from "@/controls/modules/ReasoningControlModule";
import { WebSearchControlModule } from "@/controls/modules/WebSearchControlModule";
import { WorkflowWebSearchControlModule } from "@/controls/modules/WorkflowWebSearchControlModule";
import { WebSearchToolsModule } from "@/controls/modules/WebSearchToolsModule";
import { RulesControlModule } from "@/controls/modules/RulesControlModule";
import { AutoTitleControlModule } from "@/controls/modules/AutoTitleControlModule";
import { UrlParameterControlModule } from "@/controls/modules/UrlParameterControlModule";
import { ImageGenerationControlModule } from "@/controls/modules/ImageGenerationControlModule";
import { RacePromptControlModule } from "@/controls/modules/RacePromptControlModule";
import { ImprovePromptControlModule } from "@/controls/modules/ImprovePromptControlModule";
import { PromptLibraryControlModule } from "@/controls/modules/PromptLibraryControlModule";
import { AgentControlModule } from "@/controls/modules/AgentControlModule";
import { WorkflowControlModule } from "@/controls/modules/WorkflowControlModule";
import { WorkflowDisplayModule } from "@/controls/modules/WorkflowDisplayModule";
import { OpenRouterProviderControlModule } from "@/controls/modules/OpenRouterProviderControlModule";
import { Crea8MemoryControlModule } from "@/controls/modules/Crea8MemoryControlModule";
import { SkillsPromptControlModule } from "@/controls/modules/SkillsPromptControlModule";
import { GeneralSettingsModule } from "@/controls/modules/GeneralSettingsModule";
import { NetworkLedgerSettingsModule } from "@/controls/modules/NetworkLedgerSettingsModule";
import { ThemeSettingsControlModule } from "@/controls/modules/ThemeSettingsControlModule";
import { ProviderSettingsModule } from "@/controls/modules/ProviderSettingsModule";
import { AssistantSettingsModule } from "@/controls/modules/AssistantSettingsModule";
import { RunnableBlocksSettingsModule } from "@/controls/modules/RunnableBlocksSettingsModule";
import { DataSettingsModule } from "@/controls/modules/DataSettingsModule";
import { ModSettingsModule } from "@/controls/modules/ModSettingsModule";
import { CopyActionControlModule } from "@/controls/modules/canvas/CopyActionControlModule";
import { RegenerateActionControlModule } from "@/controls/modules/canvas/RegenerateActionControlModule";
import { RaceResultExportControlModule } from "@/controls/modules/canvas/RaceResultExportControlModule";
import { RegenerateWithModelActionControlModule } from "@/controls/modules/canvas/RegenerateWithModelActionControlModule";
import { ForkActionControlModule } from "@/controls/modules/canvas/ForkActionControlModule";
import { ForkWithModelActionControlModule } from "@/controls/modules/canvas/ForkWithModelActionControlModule";
import { ForkCompactActionControlModule } from "@/controls/modules/canvas/ForkCompactActionControlModule";
import { RatingActionControlModule } from "@/controls/modules/canvas/RatingActionControlModule";
import { EditResponseControlModule } from "@/controls/modules/canvas/EditResponseControlModule";
import { EditCodeBlockControlModule } from "@/controls/modules/canvas/EditCodeBlockControlModule";
import { PromoteInteractionControlModule } from "@/controls/modules/canvas/PromoteInteractionControlModule";
import { Crea8MemoryProposalActionControlModule } from "@/controls/modules/canvas/Crea8MemoryProposalActionControlModule";
import { TableOfContentsControlModule } from "@/controls/modules/canvas/TableOfContentsControlModule";
import { FoldInteractionControlModule } from "@/controls/modules/canvas/interaction/FoldInteractionControlModule";
import { ZipDownloadControlModule } from "@/controls/modules/canvas/interaction/ZipDownloadControlModule";
import { CopyCodeBlockControlModule } from "@/controls/modules/canvas/codeblock/CopyCodeBlockControlModule";
import { FoldCodeBlockControlModule } from "@/controls/modules/canvas/codeblock/FoldCodeBlockControlModule";
import { DownloadCodeBlockControlModule } from "@/controls/modules/canvas/codeblock/DownloadCodeBlockControlModule";
import { SaveCodeBlockToVfsControlModule } from "@/controls/modules/canvas/codeblock/SaveCodeBlockToVfsControlModule";
import { UniversalRepairEnhanceControlModule } from "@/controls/modules/canvas/codeblock/RepairEnhanceCodeBlockControlModule";
import { ToolCallStepControlModule } from "@/controls/modules/canvas/tool/ToolCallStepControlModule";
import { QuoteSelectionControlModule } from "@/controls/modules/canvas/QuoteSelectionControlModule";
import { ExplainSelectionControlModule } from "@/controls/modules/canvas/ExplainSelectionControlModule";
import { CodeBlockRendererModule } from "@/controls/modules/CodeBlockRendererModule";
import { MermaidBlockRendererModule } from "@/controls/modules/MermaidBlockRendererModule";
import { FlowBlockRendererModule } from "@/controls/modules/FlowBlockRendererModule";
import { FormedibleBlockRendererModule } from "@/controls/modules/FormedibleBlockRendererModule";
import { ChartBlockRendererModule } from "@/controls/modules/ChartBlockRendererModule";
import { JsRunnableBlockRendererModule } from "@/controls/modules/JsRunnableBlockRendererModule";
import { PythonRunnableBlockRendererModule } from "@/controls/modules/PythonRunnableBlockRendererModule";
import { BeatBlockRendererModule } from "@/controls/modules/BeatBlockRendererModule";
import { WorkflowBlockRendererModule } from "@/controls/modules/WorkflowBlockRendererModule";

export const controlModulesToRegister: ControlModuleConstructor[] = [
  UrlParameterControlModule,
  PWAControlModule,
  GeneralSettingsModule,
  NetworkLedgerSettingsModule,
  ThemeSettingsControlModule,
  ProviderSettingsModule,
  AssistantSettingsModule,
  RunnableBlocksSettingsModule,
  DataSettingsModule,
  ModSettingsModule,
  ConversationListControlModule,
  SidebarToggleControlModule,
  SettingsControlModule,
  ProjectSettingsControlModule,
  GlobalModelSelectorModule,
  AutoTitleControlModule,
  UsageDisplayControlModule,
  UsageDashboardModule,
  ReasoningControlModule,
  WebSearchControlModule,
  WorkflowWebSearchControlModule,
  ImageGenerationControlModule,
  FileControlModule,
  Crea8MemoryControlModule,
  SkillsPromptControlModule,
  VfsControlModule,
  RulesControlModule,
  OpenRouterProviderControlModule,
  SystemPromptControlModule,
  ToolSelectorControlModule,
  ParameterControlModule,
  StructuredOutputControlModule,
  RacePromptControlModule,
  ImprovePromptControlModule,
  PromptLibraryControlModule,
  AgentControlModule,
  WorkflowControlModule,
  WorkflowDisplayModule,
  GitSyncControlModule,
  ManualSyncSidebarControlModule,
  VfsToolsModule,
  GitToolsModule,
  WebSearchToolsModule,
  McpToolsModule,
  CodeBlockRendererModule,
  MermaidBlockRendererModule,
  FlowBlockRendererModule,
  FormedibleBlockRendererModule,
  ChartBlockRendererModule,
  JsRunnableBlockRendererModule,
  PythonRunnableBlockRendererModule,
  BeatBlockRendererModule,
  WorkflowBlockRendererModule,
  CopyActionControlModule,
  FoldInteractionControlModule,
  ZipDownloadControlModule,
  TableOfContentsControlModule,
  PromoteInteractionControlModule,
  Crea8MemoryProposalActionControlModule,
  RegenerateActionControlModule,
  RaceResultExportControlModule,
  RegenerateWithModelActionControlModule,
  ForkActionControlModule,
  ForkWithModelActionControlModule,
  ForkCompactActionControlModule,
  EditResponseControlModule,
  RatingActionControlModule,
  CopyCodeBlockControlModule,
  FoldCodeBlockControlModule,
  DownloadCodeBlockControlModule,
  SaveCodeBlockToVfsControlModule,
  UniversalRepairEnhanceControlModule,
  EditCodeBlockControlModule,
  ToolCallStepControlModule,
  QuoteSelectionControlModule,
  ExplainSelectionControlModule,
  TextTriggerControlModule,
];
