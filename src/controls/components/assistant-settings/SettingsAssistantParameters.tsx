// src/controls/components/assitant/SettingsAssistantParameters.tsx
// FULL FILE
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSettingsStore } from "@/store/settings.store";
import { useShallow } from "zustand/react/shallow";
// import { Label } from "@/components/ui/label"; // No longer directly used
// import { Slider } from "@/components/ui/slider"; // No longer directly used
// import { Input } from "@/components/ui/input"; // No longer directly used
import { Button } from "@/components/ui/button";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { toast } from "sonner";
import { NumberField } from "@/components/LLMChef/common/form-fields/NumberField";
import { SliderField } from "@/components/LLMChef/common/form-fields/SliderField";
// ParameterControlComponent is for prompt-time overrides, not global settings.
// We will replicate its relevant UI parts here for global settings.

const assistantParamsSchema = z.object({
  temperature: z.number().min(0).max(1),
  topP: z.number().min(0).max(1),
  maxTokens: z.number().min(1).nullable(),
  topK: z.number().min(1).nullable(),
  presencePenalty: z.number().min(-2).max(2),
  frequencyPenalty: z.number().min(-2).max(2),
});

// Local FieldMetaMessages removed as it's part of primitives

export const SettingsAssistantParameters: React.FC = () => {
  const { t } = useTranslation('assistantSettings');
  const [temperatureEnabled, setTemperatureEnabled] = useState(false);
  const [topPEnabled, setTopPEnabled] = useState(false);
  const store = useSettingsStore(
    useShallow((state) => ({
      temperature: state.temperature,
      setTemperature: state.setTemperature,
      topP: state.topP,
      setTopP: state.setTopP,
      maxTokens: state.maxTokens,
      setMaxTokens: state.setMaxTokens,
      topK: state.topK,
      setTopK: state.setTopK,
      presencePenalty: state.presencePenalty,
      setPresencePenalty: state.setPresencePenalty,
      frequencyPenalty: state.frequencyPenalty,
      setFrequencyPenalty: state.setFrequencyPenalty,
    }))
  );

  const form = useForm({
    defaultValues: {
      temperature: store.temperature ?? 0.7,
      topP: store.topP ?? 1.0,
      maxTokens: store.maxTokens ?? null,
      topK: store.topK ?? null,
      presencePenalty: store.presencePenalty ?? 0.0,
      frequencyPenalty: store.frequencyPenalty ?? 0.0,
    },
    validators: {
      onChangeAsync: assistantParamsSchema,
      onChangeAsyncDebounceMs: 500,
    },
    onSubmit: async ({ value }) => {
      try {
        store.setTemperature(temperatureEnabled ? value.temperature : null);
        store.setTopP(topPEnabled ? value.topP : null);
        store.setMaxTokens(value.maxTokens ?? null);
        store.setTopK(value.topK ?? null);
        store.setPresencePenalty(value.presencePenalty);
        store.setFrequencyPenalty(value.frequencyPenalty);
        toast.success(t('parameters.updateSuccess'));
      } catch (error) {
        toast.error(t('parameters.updateError'));
        console.error("Error submitting parameters form:", error);
      }
    },
  });

  useEffect(() => {
    form.reset({
      temperature: store.temperature ?? 0.7,
      topP: store.topP ?? 1.0,
      maxTokens: store.maxTokens ?? null,
      topK: store.topK ?? null,
      presencePenalty: store.presencePenalty ?? 0.0,
      frequencyPenalty: store.frequencyPenalty ?? 0.0,
    });
    setTemperatureEnabled(store.temperature !== null);
    setTopPEnabled(store.topP !== null);
  }, [
    store.temperature,
    store.topP,
    store.maxTokens,
    store.topK,
    store.presencePenalty,
    store.frequencyPenalty,
    form,
  ]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className="space-y-4"
    >
      <p className="text-xs text-muted-foreground mb-3">
        {t('parameters.description')}
      </p>

      <div className="rounded-md border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
        Enable only the sampling parameters you want sent to the AI provider.
        If both Temperature and Top P are enabled, Temperature is sent and Top P
        is omitted because some providers reject both together.
      </div>
      
      <div className="flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={temperatureEnabled}
            onChange={(event) => setTemperatureEnabled(event.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          Send {t('parameters.temperature')}
        </label>
        {!temperatureEnabled && (
          <span className="text-xs text-muted-foreground">Off</span>
        )}
      </div>
      <SliderField
        form={form}
        name="temperature"
        label={t('parameters.temperature')}
        min={0}
        max={1}
        step={0.01}
        valueDisplayPrecision={2}
        disabled={!temperatureEnabled}
        wrapperClassName="space-y-1.5"
      />

      <div className="flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={topPEnabled}
            onChange={(event) => setTopPEnabled(event.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          Send {t('parameters.topP')}
        </label>
        {!topPEnabled && (
          <span className="text-xs text-muted-foreground">Off</span>
        )}
      </div>
      <SliderField
        form={form}
        name="topP"
        label={t('parameters.topP')}
        min={0}
        max={1}
        step={0.01}
        valueDisplayPrecision={2}
        disabled={!topPEnabled}
        wrapperClassName="space-y-1.5"
      />

      <div className="grid grid-cols-2 gap-4 items-end">
        <NumberField
          form={form}
          name="maxTokens"
          label={t('parameters.maxTokens')}
          placeholder={t('parameters.defaultNone')}
          min={1}
          className="h-9 text-sm"
          allowNull={true}
          wrapperClassName="space-y-1.5"
        />
        <NumberField
          form={form}
          name="topK"
          label={t('parameters.topK')}
          placeholder={t('parameters.defaultNone')}
          min={1}
          className="h-9 text-sm"
          allowNull={true}
          wrapperClassName="space-y-1.5"
        />
      </div>

      <SliderField
        form={form}
        name="presencePenalty"
        label={t('parameters.presencePenalty')}
        min={-2}
        max={2}
        step={0.01}
        valueDisplayPrecision={2}
        wrapperClassName="space-y-1.5"
      />

      <SliderField
        form={form}
        name="frequencyPenalty"
        label={t('parameters.frequencyPenalty')}
        min={-2}
        max={2}
        step={0.01}
        valueDisplayPrecision={2}
        wrapperClassName="space-y-1.5"
      />

      <div className="flex justify-end space-x-2">
        <Button
          type="button"
          variant="ghost"
          onClick={() => form.reset()}
          disabled={!form.state.isDirty}
        >
          {t('common.reset')}
        </Button>
        <form.Subscribe
          selector={(state) => [state.canSubmit, state.isSubmitting]}
          children={([canSubmit, isSubmitting]) => (
            <Button type="submit" disabled={!canSubmit || isSubmitting}>
              {isSubmitting ? t('common.saving') : t('common.saveChanges')}
            </Button>
          )}
        />
      </div>
    </form>
  );
};
