// src/controls/modules/MarketplaceSettingsModule.ts

import { type ControlModule } from "@/types/litechat/control";
import { type LiteChatModApi } from "@/types/litechat/modding";
import { createLazySettingTab } from "@/controls/components/settings/LazySettingTab";
import i18next from 'i18next';
import type { ControlModuleConstructor } from '@/types/litechat/control';

const SettingsMarketplace = createLazySettingTab(() =>
  import("@/controls/components/marketplace-settings/SettingsMarketplace").then((module) => ({
    default: module.SettingsMarketplace,
  }))
);

export class MarketplaceSettingsModule implements ControlModule {
  readonly id = "core-settings-marketplace";
  private unregisterCallback: (() => void) | null = null;

  async initialize(): Promise<void> {
    // console.log(`[${this.id}] Initialized.`);
  }

  register(modApi: LiteChatModApi): void {
    if (this.unregisterCallback) {
      console.warn(`[${this.id}] Already registered. Skipping.`);
      return;
    }
    this.unregisterCallback = modApi.registerSettingsTab({
      id: "marketplace",
      title: i18next.t("controls:settings.tabs.marketplace"),
      component: SettingsMarketplace,
      order: 65,
    });
    // console.log(`[${this.id}] Settings tab registered.`);
  }

  destroy(): void {
    if (this.unregisterCallback) {
      this.unregisterCallback();
      this.unregisterCallback = null;
    }
    console.log(`[${this.id}] Destroyed.`);
  }
}

(MarketplaceSettingsModule as ControlModuleConstructor).translations = {
  en: {
    controls: {
      "settings.tabs.marketplace": "Marketplace"
    }
  },
  fr: {
    controls: {
      "settings.tabs.marketplace": "Marché"
    }
  }
};
