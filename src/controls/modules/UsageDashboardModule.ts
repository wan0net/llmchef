// src/controls/modules/UsageDashboardModule.ts
// Module for usage dashboard functionality

import { type ControlModule } from "@/types/llmchef/control";
import { type LLMChefModApi } from "@/types/llmchef/modding";
import { createLazySettingTab } from "@/controls/components/settings/LazySettingTab";

const UsageDashboard = createLazySettingTab(() =>
  import("@/controls/components/usage/UsageDashboard").then((module) => ({
    default: module.UsageDashboard,
  }))
);

export class UsageDashboardModule implements ControlModule {
  readonly id = "core-usage-dashboard";
  private unregisterCallback: (() => void) | null = null;

  async initialize(): Promise<void> {
    console.log(`[${this.id}] Initialized.`);
  }

  register(modApi: LLMChefModApi): void {
    if (this.unregisterCallback) {
      console.warn(`[${this.id}] Already registered. Skipping.`);
      return;
    }

    this.unregisterCallback = modApi.registerSettingsTab({
      id: this.id,
      title: "Usage",
      component: UsageDashboard,
    });

    console.log(`[${this.id}] Registered.`);
  }

  destroy(): void {
    if (this.unregisterCallback) {
      this.unregisterCallback();
      this.unregisterCallback = null;
    }
    console.log(`[${this.id}] Destroyed.`);
  }
}
