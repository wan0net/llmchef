import React from "react";
import { type ControlModule } from "@/types/llmchef/control";
import { type LLMChefModApi } from "@/types/llmchef/modding";
import { createLazySettingTab } from "@/controls/components/settings/LazySettingTab";
import { useSettingsStore } from "@/store/settings.store";
import { settingsEvent } from "@/types/llmchef/events/settings.events";

const SettingsRunnableBlocks = createLazySettingTab(() =>
  import("@/controls/components/runnable-blocks-settings/SettingsRunnableBlocks").then((module) => ({
    default: module.SettingsRunnableBlocks,
  }))
);

export class RunnableBlocksSettingsModule implements ControlModule {
  readonly id = "core-settings-runnable-blocks";
  private unregisterCallback: (() => void) | null = null;
  private eventUnsubscribers: (() => void)[] = [];
  private isVisible = false;

  async initialize(modApi: LLMChefModApi): Promise<void> {
    // Tab is visible when advanced settings is enabled (since runnable blocks is an advanced feature)
    this.isVisible = useSettingsStore.getState().enableAdvancedSettings;

    const unsubSettings = modApi.on(
      settingsEvent.enableAdvancedSettingsChanged,
      (payload) => {
        if (typeof payload === "object" && payload && "enabled" in payload) {
          if (this.isVisible !== payload.enabled) {
            this.isVisible = payload.enabled;
            // Update registration without destroying event subscriptions
            if (this.isVisible && !this.unregisterCallback) {
              this.register(modApi);
            } else if (!this.isVisible && this.unregisterCallback) {
              this.unregisterCallback();
              this.unregisterCallback = null;
            }
          }
        }
      }
    );
    this.eventUnsubscribers.push(unsubSettings);
  }

  register(modApi: LLMChefModApi): void {
    if (this.isVisible && !this.unregisterCallback) {
      this.unregisterCallback = modApi.registerSettingsTab({
        id: "runnable-blocks",
        title: "Runnable Blocks",
        component: () => React.createElement(SettingsRunnableBlocks),
        order: 45,
      });
    }
  }

  destroy(): void {
    this.eventUnsubscribers.forEach((unsub) => unsub());
    this.eventUnsubscribers = [];
    if (this.unregisterCallback) {
      this.unregisterCallback();
      this.unregisterCallback = null;
    }
    console.log(`[${this.id}] Destroyed.`);
  }
}
