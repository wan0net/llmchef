import React from 'react';
import type { WorkflowStep } from '@/types/llmchef/workflow';
import type { PromptTemplate } from '@/types/llmchef/prompt-template';
import type { ModelListItem } from '@/types/llmchef/provider';

export interface BaseStepConfigProps {
  step: WorkflowStep;
  onChange: (updatedStep: WorkflowStep) => void;
  promptTemplates: PromptTemplate[];
  agentTasks: (PromptTemplate & { prefixedName: string })[];
  models: ModelListItem[];
  tools?: Array<{ name: string; description?: string }>;
  module?: any;
  workflow?: any;
  stepIndex?: number;
}

export interface StepConfigComponent {
  (props: BaseStepConfigProps): React.ReactElement;
}