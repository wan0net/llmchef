import React from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { workflowEvent } from "@/types/llmchef/events/workflow.events";
import { emitter } from "@/lib/llmchef/event-emitter";
import type { WorkflowTemplate } from "@/types/llmchef/workflow";

interface WorkflowShortcutToggleProps {
  workflow: WorkflowTemplate;
  onToggle?: (enabled: boolean) => void;
}

export const WorkflowShortcutToggle: React.FC<WorkflowShortcutToggleProps> = ({
  workflow,
  onToggle
}) => {
  const handleShortcutToggle = (checked: boolean) => {
    // Emit update event using event-driven architecture
    emitter.emit(workflowEvent.updateWorkflowRequest, {
      id: workflow.id,
      updates: { isShortcut: checked }
    });
    
    // Call optional callback
    onToggle?.(checked);
  };

  return (
    <div className="flex items-center space-x-2">
      <Switch
        id={`shortcut-${workflow.id}`}
        checked={workflow.isShortcut || false}
        onCheckedChange={handleShortcutToggle}
      />
      <Label htmlFor={`shortcut-${workflow.id}`} className="text-xs text-muted-foreground">
        Quick Access
      </Label>
    </div>
  );
}; 