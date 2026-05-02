import { useEffect, useState } from "react";
import { LLMChef } from "@/components/LLMChef/LLMChef";
import { PrismThemeLoader } from "@/components/LLMChef/common/PrismThemeLoader";
import { ThemeManager } from "@/components/LLMChef/common/ThemeManager";
import type { ControlModuleConstructor } from "@/types/llmchef/control";

const loadControlModules = async (): Promise<ControlModuleConstructor[]> => {
  const { controlModulesToRegister } = await import("./LLMChefControlModules");
  return controlModulesToRegister;
};

export function LLMChefApp() {
  const [controls, setControls] = useState<ControlModuleConstructor[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadControlModules().then((loadedControls) => {
      if (!cancelled) setControls(loadedControls);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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
