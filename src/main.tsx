// src/main.tsx
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { enableMapSet } from "immer";
import { installOutboundFetchGuard } from "./services/outbound-fetch-guard.service";
import { installVfsTimeline } from "./lib/llmchef/vfs-timeline";
import "./i18n/config"; // Initialize i18next

enableMapSet();
installOutboundFetchGuard();
installVfsTimeline();

const initializePwaWhenIdle = () => {
  const initialize = () => {
    void import("./services/pwa.service")
      .then(({ PWAService }) => PWAService.initialize())
      .then(() => {
        console.log("PWA service initialized successfully");
      })
      .catch((error) => {
        console.error("PWA service initialization failed:", error);
      });
  };

  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(initialize, { timeout: 3000 });
    return;
  }

  window.setTimeout(initialize, 1000);
};

initializePwaWhenIdle();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <App />
);
