import { registerSW } from "virtual:pwa-register";
import { emitter } from "@/lib/llmchef/event-emitter";
import { pwaEvent } from "@/types/llmchef/events/pwa.events";
import { toast } from "sonner";
import { BackgroundTaskToast } from "@/services/background-task-toast.service";

export class PWAService {
  private static instance: PWAService | null = null;
  private updateSW: ((reloadPage?: boolean) => Promise<void>) | null = null;
  private offlineReady = false;
  private needRefresh = false;
  private updateCheckPromise: Promise<void> | null = null;

  private constructor() {
    // Private constructor for singleton
  }

  public static getInstance(): PWAService {
    if (!PWAService.instance) {
      PWAService.instance = new PWAService();
    }
    return PWAService.instance;
  }

  public static async initialize(): Promise<void> {
    const instance = PWAService.getInstance();
    await instance.registerServiceWorker();
  }

  private async registerServiceWorker(): Promise<void> {
    if (!("serviceWorker" in navigator)) {
      console.log("Service Worker not supported");
      return;
    }

    // Skip registration in development mode
    if (import.meta.env.DEV) {
      console.log("PWA Service Worker skipped in development mode");
      return;
    }

    try {
      this.updateSW = registerSW({
        onNeedRefresh: () => {
          this.needRefresh = true;
          this.handleUpdateAvailable();
        },
        onOfflineReady: () => {
          this.offlineReady = true;
          this.handleOfflineReady();
        },
        onRegisterError: (error: Error) => {
          this.handleUpdateError(error, "Service Worker registration failed");
        },
      });

      console.log("PWA Service Worker registered successfully");
    } catch (error) {
      console.error("PWA Service Worker registration failed:", error);
      this.handleUpdateError(
        error as Error,
        "Service Worker registration failed"
      );
    }
  }

  private handleUpdateAvailable(): void {
    if (!this.updateSW) return;

    emitter.emit(pwaEvent.updateAvailable, {
      updateSW: this.updateSW,
      showUpdatePrompt: true,
    });

    // Show toast notification
    toast("Update Available", {
      id: "pwa-update-available",
      description: "A new version of LLMChef is available. Click to update.",
      action: {
        label: "Update Now",
        onClick: () => this.acceptUpdate(),
      },
      duration: 10000,
    });
  }


  private handleOfflineReady(): void {
    emitter.emit(pwaEvent.offlineReady, {
      timestamp: Date.now(),
    });

    toast.success("App Ready", {
      id: "pwa-offline-ready",
      description: "LLMChef is now ready to work offline.",
      duration: 5000,
    });
  }

  private handleUpdateError(error: Error, context: string): void {
    emitter.emit(pwaEvent.updateError, {
      error,
      context,
    });

    BackgroundTaskToast.error({
      id: "pwa-update-check",
      message: "Update Error",
      description: `Failed to update the app: ${error.message}`,
    });
  }

  public async acceptUpdate(): Promise<void> {
    if (!this.updateSW) return;

    try {
      BackgroundTaskToast.loading({
        id: "pwa-install-update",
        message: "Installing update...",
        description: "LLMChef will reload when the new build is ready.",
      });
      emitter.emit(pwaEvent.updateAccepted, {
        updateSW: this.updateSW,
      });

      await this.updateSW(true);

      emitter.emit(pwaEvent.updateInstalled, {
        needsRefresh: false,
      });
      BackgroundTaskToast.success({
        id: "pwa-install-update",
        message: "Update installed",
        description: "LLMChef has been updated successfully.",
      });
    } catch (error) {
      this.handleUpdateError(error as Error, "Update installation failed");
    }
  }

  public rejectUpdate(): void {
    emitter.emit(pwaEvent.updateRejected, {
      timestamp: Date.now(),
    });

    toast.info("Update Postponed", {
      description: "You can update later by refreshing the page.",
      duration: 5000,
    });
  }

  public isUpdateAvailable(): boolean {
    return this.needRefresh;
  }

  public isOfflineReady(): boolean {
    return this.offlineReady;
  }

  public async checkForUpdates(): Promise<void> {
    if (this.updateCheckPromise) {
      BackgroundTaskToast.loading({
        id: "pwa-update-check",
        message: "Checking for updates...",
        description: "An update check is already running.",
      });
      return this.updateCheckPromise;
    }

    if (!this.updateSW) {
      console.log("No update service worker available");
      BackgroundTaskToast.info({
        id: "pwa-update-check",
        message: "Update checks unavailable",
        description: "The service worker is not active in this environment.",
      });
      return;
    }

    this.updateCheckPromise = (async () => {
      BackgroundTaskToast.loading({
        id: "pwa-update-check",
        message: "Checking for updates...",
        description: "Looking for a newer LLMChef build.",
      });

      // Force check for updates by calling the service worker update function
      // This will trigger the onNeedRefresh callback if an update is available
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        await registration.update();
        console.log("Manual update check completed");
      }

      if (this.needRefresh) {
        BackgroundTaskToast.success({
          id: "pwa-update-check",
          message: "Update found",
          description: "A new version is ready to install.",
        });
      } else {
        BackgroundTaskToast.success({
          id: "pwa-update-check",
          message: "LLMChef is up to date",
          description: "No newer local app bundle was found.",
        });
      }
    })();

    try {
      await this.updateCheckPromise;
    } catch (error) {
      console.error("Manual update check failed:", error);
      this.handleUpdateError(error as Error, "Manual update check failed");
    } finally {
      this.updateCheckPromise = null;
    }
  }
}
