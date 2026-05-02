// src/controls/components/canvas/ExplainSelectionControl.tsx
import React from "react";
import { ActionTooltipButton } from "@/components/LLMChef/common/ActionTooltipButton";
import { InfoIcon } from "lucide-react";
import { emitter } from "@/lib/llmchef/event-emitter";
import { canvasEvent } from "@/types/llmchef/events/canvas.events";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import type { SelectionControlContext } from "@/types/llmchef/canvas/control";

interface ExplainSelectionControlProps {
  context: SelectionControlContext;
}

export const ExplainSelectionControl: React.FC<ExplainSelectionControlProps> = ({ context }) => {
  const { t } = useTranslation('canvas');

  const handleExplain = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!context.interactionId) {
      toast.error(t('selection.explainError', 'Cannot explain: No interaction found'));
      return;
    }
    
    emitter.emit(canvasEvent.explainSelectionRequest, { 
      selectedText: context.selectedText,
      interactionId: context.interactionId
    });
    
    toast.success(t('selection.explainStarted', 'Generating explanation...'));
    
    // Clear selection after explaining
    window.getSelection()?.removeAllRanges();
  };

  return (
    <ActionTooltipButton
      tooltipText={t('selection.explain', 'Explain')}
      onClick={handleExplain}
      aria-label={t('selection.explainAriaLabel', 'Explain selected text')}
      icon={<InfoIcon />}
      className="h-6 w-6 text-muted-foreground hover:text-foreground border border-primary"
    />
  );
};