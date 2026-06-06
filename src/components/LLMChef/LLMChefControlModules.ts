import type { ControlModuleConstructor } from "@/types/llmchef/control";
import { AutoTitleControlModule } from "@/controls/modules/AutoTitleControlModule";
import { BeatBlockRendererModule } from "@/controls/modules/BeatBlockRendererModule";
import { ChartBlockRendererModule } from "@/controls/modules/ChartBlockRendererModule";
import { CodeBlockRendererModule } from "@/controls/modules/CodeBlockRendererModule";
import { ConversationListControlModule } from "@/controls/modules/ConversationListControlModule";
import { CopyActionControlModule } from "@/controls/modules/canvas/CopyActionControlModule";
import { CopyCodeBlockControlModule } from "@/controls/modules/canvas/codeblock/CopyCodeBlockControlModule";
import { Crea8MemoryControlModule } from "@/controls/modules/Crea8MemoryControlModule";
import { Crea8MemoryProposalActionControlModule } from "@/controls/modules/canvas/Crea8MemoryProposalActionControlModule";
import { DocumentReadToolsModule } from "@/controls/modules/DocumentReadToolsModule";
import { DownloadCodeBlockControlModule } from "@/controls/modules/canvas/codeblock/DownloadCodeBlockControlModule";
import { EditCodeBlockControlModule } from "@/controls/modules/canvas/EditCodeBlockControlModule";
import { EditResponseControlModule } from "@/controls/modules/canvas/EditResponseControlModule";
import { ExplainSelectionControlModule } from "@/controls/modules/canvas/ExplainSelectionControlModule";
import { FileControlModule } from "@/controls/modules/FileControlModule";
import { FlowBlockRendererModule } from "@/controls/modules/FlowBlockRendererModule";
import { FoldCodeBlockControlModule } from "@/controls/modules/canvas/codeblock/FoldCodeBlockControlModule";
import { FoldInteractionControlModule } from "@/controls/modules/canvas/interaction/FoldInteractionControlModule";
import { ForkActionControlModule } from "@/controls/modules/canvas/ForkActionControlModule";
import { ForkCompactActionControlModule } from "@/controls/modules/canvas/ForkCompactActionControlModule";
import { ForkWithModelActionControlModule } from "@/controls/modules/canvas/ForkWithModelActionControlModule";
import { FormedibleBlockRendererModule } from "@/controls/modules/FormedibleBlockRendererModule";
import { GlobalModelSelectorModule } from "@/controls/modules/GlobalModelSelectorModule";
import { JsRunnableBlockRendererModule } from "@/controls/modules/JsRunnableBlockRendererModule";
import { MermaidBlockRendererModule } from "@/controls/modules/MermaidBlockRendererModule";
import { OpenRouterProviderControlModule } from "@/controls/modules/OpenRouterProviderControlModule";
import { ParameterControlModule } from "@/controls/modules/ParameterControlModule";
import { ProjectSettingsControlModule } from "@/controls/modules/ProjectSettingsControlModule";
import { PromoteInteractionControlModule } from "@/controls/modules/canvas/PromoteInteractionControlModule";
import { PWAControlModule } from "@/controls/modules/PWAControlModule";
import { PythonInterpreterToolModule } from "@/controls/modules/PythonInterpreterToolModule";
import { PythonRunnableBlockRendererModule } from "@/controls/modules/PythonRunnableBlockRendererModule";
import { QuoteSelectionControlModule } from "@/controls/modules/canvas/QuoteSelectionControlModule";
import { RatingActionControlModule } from "@/controls/modules/canvas/RatingActionControlModule";
import { ReasoningControlModule } from "@/controls/modules/ReasoningControlModule";
import { RegenerateActionControlModule } from "@/controls/modules/canvas/RegenerateActionControlModule";
import { RegenerateWithModelActionControlModule } from "@/controls/modules/canvas/RegenerateWithModelActionControlModule";
import { RulesControlModule } from "@/controls/modules/RulesControlModule";
import { SaveCodeBlockToVfsControlModule } from "@/controls/modules/canvas/codeblock/SaveCodeBlockToVfsControlModule";
import { SettingsControlModule } from "@/controls/modules/SettingsControlModule";
import { SidebarToggleControlModule } from "@/controls/modules/SidebarToggleControlModule";
import { SkillsPromptControlModule } from "@/controls/modules/SkillsPromptControlModule";
import { StructuredOutputControlModule } from "@/controls/modules/StructuredOutputControlModule";
import { SystemPromptControlModule } from "@/controls/modules/SystemPromptControlModule";
import { TableOfContentsControlModule } from "@/controls/modules/canvas/TableOfContentsControlModule";
import { TextTriggerControlModule } from "@/controls/modules/TextTriggerControlModule";
import { ToolCallStepControlModule } from "@/controls/modules/canvas/tool/ToolCallStepControlModule";
import { ToolSelectorControlModule } from "@/controls/modules/ToolSelectorControlModule";
import { UniversalRepairEnhanceControlModule } from "@/controls/modules/canvas/codeblock/RepairEnhanceCodeBlockControlModule";
import { UrlParameterControlModule } from "@/controls/modules/UrlParameterControlModule";
import { UsageDisplayControlModule } from "@/controls/modules/UsageDisplayControlModule";
import { VfsControlModule } from "@/controls/modules/VfsControlModule";
import { WorkflowBlockRendererModule } from "@/controls/modules/WorkflowBlockRendererModule";
import { ZipDownloadControlModule } from "@/controls/modules/canvas/interaction/ZipDownloadControlModule";

export const controlModulesToRegister: ControlModuleConstructor[] = [
  TextTriggerControlModule,
  UrlParameterControlModule,
  PWAControlModule,
  ConversationListControlModule,
  SidebarToggleControlModule,
  SettingsControlModule,
  ProjectSettingsControlModule,
  GlobalModelSelectorModule,
  AutoTitleControlModule,
  UsageDisplayControlModule,
  ReasoningControlModule,
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
  CodeBlockRendererModule,
  MermaidBlockRendererModule,
  FlowBlockRendererModule,
  FormedibleBlockRendererModule,
  ChartBlockRendererModule,
  JsRunnableBlockRendererModule,
  PythonRunnableBlockRendererModule,
  PythonInterpreterToolModule,
  DocumentReadToolsModule,
  BeatBlockRendererModule,
  WorkflowBlockRendererModule,
  CopyActionControlModule,
  FoldInteractionControlModule,
  ZipDownloadControlModule,
  TableOfContentsControlModule,
  PromoteInteractionControlModule,
  Crea8MemoryProposalActionControlModule,
  RegenerateActionControlModule,
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
];
