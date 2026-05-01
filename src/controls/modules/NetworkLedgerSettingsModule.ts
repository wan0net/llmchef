import { type ControlModule, type ControlModuleConstructor } from "@/types/litechat/control";
import { type LiteChatModApi } from "@/types/litechat/modding";
import { createLazySettingTab } from "@/controls/components/settings/LazySettingTab";
import i18next from "i18next";

const SettingsNetworkLedger = createLazySettingTab(() =>
  import("@/controls/components/network-settings/SettingsNetworkLedger")
);

export class NetworkLedgerSettingsModule implements ControlModule {
  readonly id = "core-settings-network-ledger";
  private unregisterCallback: (() => void) | null = null;

  async initialize(): Promise<void> {
    // Settings tab only.
  }

  register(modApi: LiteChatModApi): void {
    if (this.unregisterCallback) {
      console.warn(`[${this.id}] Already registered. Skipping.`);
      return;
    }

    this.unregisterCallback = modApi.registerSettingsTab({
      id: "network",
      title: i18next.t("controls:settings.tabs.network"),
      component: SettingsNetworkLedger,
      order: 15,
    });
  }

  destroy(): void {
    if (this.unregisterCallback) {
      this.unregisterCallback();
      this.unregisterCallback = null;
    }
    console.log(`[${this.id}] Destroyed.`);
  }
}

(NetworkLedgerSettingsModule as ControlModuleConstructor).translations = {
  en: {
    controls: {
      "settings.tabs.network": "Network",
    },
  },
  fr: {
    controls: {
      "settings.tabs.network": "Réseau",
    },
  },
};
