import { useEffect, useRef, useState } from "react";
import { LLMChef } from "@/components/LLMChef/LLMChef";
import { PrismThemeLoader } from "@/components/LLMChef/common/PrismThemeLoader";
import { ThemeManager } from "@/components/LLMChef/common/ThemeManager";
import type { ControlModuleConstructor } from "@/types/llmchef/control";

const loadControlModules = async (): Promise<ControlModuleConstructor[]> => {
  const { controlModulesToRegister } = await import("./LLMChefControlModules");
  return controlModulesToRegister;
};

const loadStagedControlModules = async (): Promise<ControlModuleConstructor[]> => {
  const { loadAdvancedControlModules } = await import(
    "./LLMChefAdvancedControlModules"
  );
  return loadAdvancedControlModules();
};

export function LLMChefApp() {
  const [controls, setControls] = useState<ControlModuleConstructor[] | null>(null);
  const stagedControlsRequestedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void loadControlModules().then((loadedControls) => {
      if (!cancelled) setControls(loadedControls);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!controls || stagedControlsRequestedRef.current) return;
    stagedControlsRequestedRef.current = true;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void loadStagedControlModules()
        .then((stagedControls) => {
          if (cancelled) return;
          setControls((current) =>
            current ? [...current, ...stagedControls] : stagedControls,
          );
        })
        .catch((error) => {
          console.error("[LLMChefApp] Failed to load staged controls:", error);
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [controls]);

  return (
    <>
      <ThemeManager />
      <PrismThemeLoader />
      <div className="h-screen bg-background text-foreground flex flex-col">
        <main className="flex-grow overflow-hidden">
          {controls ? <LLMChef controls={controls} /> : null}
        </main>
      </div>
    </>
  );
}
