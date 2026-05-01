// src/controls/modules/AssistantSettingsModule.ts
// FULL FILE
import { type ControlModule } from "@/types/litechat/control";
import { type LiteChatModApi } from "@/types/litechat/modding";
import { createLazySettingTab } from "@/controls/components/settings/LazySettingTab";
import i18next from 'i18next';
import type { ControlModuleConstructor } from '@/types/litechat/control';

const SettingsAssistant = createLazySettingTab(() =>
  import("@/controls/components/assistant-settings/SettingsAssistant").then((module) => ({
    default: module.SettingsAssistant,
  }))
);

export class AssistantSettingsModule implements ControlModule {
  readonly id = "core-settings-assistant";
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
      id: "assistant",
      title: i18next.t("controls:settings.tabs.assistant"),
      component: SettingsAssistant,
      order: 40,
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

(AssistantSettingsModule as ControlModuleConstructor).translations = {
  en: {
    controls: {
      "settings.tabs.assistant": "Assistant"
    }
  },
  fr: {
    controls: {
      "settings.tabs.assistant": "Assistant"
    }
  }
};
