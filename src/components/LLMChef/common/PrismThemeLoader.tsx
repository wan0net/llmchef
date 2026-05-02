import { useEffect } from "react";
import { useSettingsStore } from "@/store/settings.store";

const PRISM_THEME_LINK_ID = "prism-theme-link";
const DEFAULT_LIGHT_THEME_LINK_ID = "prism-default-light-theme-link";
const DEFAULT_DARK_THEME_LINK_ID = "prism-default-dark-theme-link";

const isLocalStylesheetUrl = (url: string): boolean => {
  if (!url.trim()) return false;
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.origin === window.location.origin;
  } catch {
    return false;
  }
};

// Helper to ensure link exists and set attributes
const ensureLinkElement = (id: string): HTMLLinkElement => {
  let link = document.getElementById(id) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }
  return link;
};

export const PrismThemeLoader: React.FC = () => {
  const prismThemeUrl = useSettingsStore((state) => state.prismThemeUrl);

  useEffect(() => {
    // Only run in browser environment
    if (typeof window === "undefined") return;

    // Create all three link elements
    const lightLink = ensureLinkElement(DEFAULT_LIGHT_THEME_LINK_ID);
    const darkLink = ensureLinkElement(DEFAULT_DARK_THEME_LINK_ID);
    const customLink = ensureLinkElement(PRISM_THEME_LINK_ID);

    // Disable all links first
    lightLink.disabled = true;
    darkLink.disabled = true;
    customLink.disabled = true;

    if (prismThemeUrl && isLocalStylesheetUrl(prismThemeUrl)) {
      customLink.href = prismThemeUrl;
      customLink.disabled = false;
    }

    // Clean up function
    return () => {
      // No cleanup needed for link elements as they persist
    };
  }, [prismThemeUrl]);

  return null;
};
