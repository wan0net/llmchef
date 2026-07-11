// src/controls/components/settings/SettingsProviderRowView.tsx
// FULL FILE
import React, { useMemo, useCallback, useState } from "react";
import type {
  DbProviderConfig,
  DbApiKey,
  OpenRouterModel,
} from "@/types/llmchef/provider";
import { Button } from "@/components/ui/button";
import {
  Edit2Icon,
  Trash2Icon,
  Loader2,
  RefreshCwIcon,
  CheckIcon,
  AlertCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  requiresApiKey,
  requiresBaseURL,
  supportsModelFetching,
  // combineModelId,
} from "@/lib/llmchef/provider-helpers";
import { cn } from "@/lib/utils";
import { ModelEnablementList } from "./ModelEnablementList";
import { toast } from "sonner";
import { ActionTooltipButton } from "@/components/LLMChef/common/ActionTooltipButton";
import { useTranslation } from "react-i18next";

type FetchStatus = "idle" | "fetching" | "error" | "success";

interface ProviderRowViewModeProps {
  provider: DbProviderConfig;
  apiKeys: DbApiKey[];
  onEdit: () => void;
  onDelete: () => Promise<void>;
  onFetchModels: () => Promise<void>;
  onUpdate: (id: string, changes: Partial<DbProviderConfig>) => Promise<void>;
  fetchStatus: FetchStatus;
  isDeleting: boolean;
  onSelectModelForDetails: (combinedModelId: string | null) => void;
  allAvailableModelsForView: OpenRouterModel[];
}

const ProviderRowViewModeComponent: React.FC<ProviderRowViewModeProps> = ({
  provider,
  apiKeys,
  onEdit,
  onDelete,
  onFetchModels,
  onUpdate,
  fetchStatus,
  isDeleting,
  // onSelectModelForDetails,
  allAvailableModelsForView,
}) => {
  const { t } = useTranslation('settings');
  const [isModelListFolded, setIsModelListFolded] = useState(true);

  const needsKey = requiresApiKey(provider.type);
  const needsURL = requiresBaseURL(provider.type);
  const canFetch = supportsModelFetching(provider.type);
  const isFetchButtonDisabled = fetchStatus === "fetching" || isDeleting;
  const isEditButtonDisabled = isDeleting || fetchStatus === "fetching";
  const isDeleteButtonDisabled = isDeleting || fetchStatus === "fetching";

  const enabledModelsSet = useMemo(
    () => new Set(provider.enabledModels ?? []),
    [provider.enabledModels]
  );

  const apiKeyLinked = provider.apiKeyId
    ? apiKeys.some((k) => k.id === provider.apiKeyId)
    : false;
  const showKeyWarning = needsKey && !apiKeyLinked;

  const handleModelToggle = useCallback(
    async (modelId: string, checked: boolean) => {
      const currentEnabledSet = new Set(provider.enabledModels ?? []);
      if (checked) {
        currentEnabledSet.add(modelId);
      } else {
        currentEnabledSet.delete(modelId);
      }
      const newEnabledModels = Array.from(currentEnabledSet);

      try {
        await onUpdate(provider.id, { enabledModels: newEnabledModels });
      } catch (error) {
        toast.error("Failed to update model status.");
        console.error("Failed to save model toggle:", error);
      }
    },
    [provider.enabledModels, provider.id, onUpdate]
  );

  const toggleFold = () => setIsModelListFolded((prev) => !prev);

  const enabledCount = provider.enabledModels?.length ?? 0;
  const availableCount = allAvailableModelsForView.length;

  // const handleModelClick = (modelId: string) => {
  //   const combinedId = combineModelId(provider.id, modelId);
  //   onSelectModelForDetails(combinedId);
  // };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3 min-w-0">
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger>
                <span
                  className={cn(
                    "h-2.5 w-2.5 rounded-full flex-shrink-0 block",
                    fetchStatus === "error"
                      ? "bg-destructive animate-pulse"
                      : provider.isEnabled
                      ? "bg-green-500"
                      : "bg-muted-foreground"
                  )}
                />
              </TooltipTrigger>
              <TooltipContent side="top">
                {fetchStatus === "error"
                  ? t('provider.status.errorFetching')
                  : provider.isEnabled
                  ? t('provider.status.enabled')
                  : t('provider.status.disabled')}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <h3 className="font-semibold text-lg text-card-foreground truncate">
            {provider.name}
          </h3>
          <span className="text-sm text-muted-foreground flex-shrink-0">
            ({provider.type})
          </span>
          {showKeyWarning && (
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger>
                  <AlertCircleIcon className="h-4 w-4 text-amber-500 flex-shrink-0" />
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>{t('provider.apiKeyRequiredTooltip')}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <div className="flex items-center space-x-1 flex-shrink-0">
          <ActionTooltipButton
            tooltipText={t('provider.edit')}
            onClick={onEdit}
            disabled={isEditButtonDisabled}
            aria-label={t('provider.editAriaLabel')}
            icon={<Edit2Icon />}
            className="h-8 w-8"
          />
          <ActionTooltipButton
            tooltipText={t('provider.delete')}
            onClick={onDelete}
            disabled={isDeleteButtonDisabled}
            className="text-destructive hover:text-destructive/80 h-8 w-8"
            aria-label={t('provider.deleteAriaLabel')}
            icon={
              isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2Icon />
              )
            }
          />
        </div>
      </div>

      <div className="text-sm text-muted-foreground mt-1 space-y-1 pl-5">
        {needsKey && (
          <div>
            {t('provider.apiKeyLabel')}{" "}
            {provider.apiKeyId ? (
              apiKeyLinked ? (
                <span className="text-green-400">
                  {apiKeys.find((k) => k.id === provider.apiKeyId)?.name ||
                    t('provider.linkedUnnamedKey')}
                </span>
              ) : (
                <span className="text-destructive">{t('provider.linkedKeyMissing')}</span>
              )
            ) : (
              <span className="text-amber-400">{t('provider.notLinked')}</span>
            )}
          </div>
        )}
        {needsURL && <div>{t('provider.baseUrlLabel')} {provider.baseURL || t('provider.notSet')}</div>}
        <div>
          {t('provider.autoFetchModelsLabel')}{" "}
          {provider.autoFetchModels ? (
            <span className="text-green-400">{t('provider.enabled')}</span>
          ) : (
            <span className="text-muted-foreground/80">{t('provider.disabled')}</span>
          )}
          {provider.fetchedModels && (
            <span className="text-xs text-muted-foreground/80 ml-2">
              ({t('provider.lastFetched')}{" "}
              {provider.modelsLastFetchedAt
                ? new Date(provider.modelsLastFetchedAt).toLocaleString()
                : t('provider.never')}
              )
            </span>
          )}
        </div>
        {canFetch && (
          <div className="pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={onFetchModels}
              disabled={isFetchButtonDisabled}
              className="text-xs h-7 px-2"
            >
              {fetchStatus === "fetching" && (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              )}
              {fetchStatus === "success" && (
                <CheckIcon className="h-3 w-3 mr-1 text-green-500" />
              )}
              {fetchStatus === "error" && (
                <AlertCircleIcon className="h-3 w-3 mr-1 text-destructive" />
              )}
              {fetchStatus === "idle" && (
                <RefreshCwIcon className="h-3 w-3 mr-1" />
              )}
              {fetchStatus === "fetching"
                ? t('provider.fetching')
                : fetchStatus === "error"
                ? t('provider.fetchFailed')
                : t('provider.fetchModelsNow')}
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-1 pt-2">
        <div className="flex items-center justify-between">
          <span className="font-medium text-card-foreground text-sm">
            {t('provider.modelEnablement', { enabledCount, availableCount })}
          </span>
          <ActionTooltipButton
            tooltipText={isModelListFolded ? t('provider.showModels') : t('provider.hideModels')}
            onClick={toggleFold}
            aria-label={
              isModelListFolded ? t('provider.showModelsAria') : t('provider.hideModelsAria')
            }
            icon={isModelListFolded ? <ChevronDownIcon /> : <ChevronUpIcon />}
            className="h-6 w-6"
          />
        </div>
        {!isModelListFolded && (
          <ModelEnablementList
            providerId={provider.id}
            allAvailableModels={allAvailableModelsForView}
            enabledModelIds={enabledModelsSet}
            onToggleModel={handleModelToggle}
            isLoading={fetchStatus === "fetching"}
            disabled={isDeleting}
            listHeightClass="h-[26rem]" // Updated height
            // onModelClick={handleModelClick}
          />
        )}
      </div>
    </div>
  );
};

export const ProviderRowViewMode = React.memo(ProviderRowViewModeComponent);
