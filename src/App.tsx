import { lazy, Suspense, useEffect, useState } from "react";
import { LandingPage } from "@/components/LandingPage";
import { ErrorBoundary } from "@/components/LLMChef/common/ErrorBoundary";

const LLMChefApp = lazy(() =>
  import("@/components/LLMChef/LLMChefApp").then((module) => ({
    default: module.LLMChefApp,
  })),
);

function shouldRenderAppRoute() {
  return (
    window.location.hash === "#app" ||
    window.location.search.includes("app=1") ||
    window.location.pathname.replace(/\/$/, "").endsWith("/app")
  );
}

function App() {
  const [shouldShowApp, setShouldShowApp] = useState(shouldRenderAppRoute);
  const base = import.meta.env.BASE_URL;
  const appHref = `${base}#app`;
  const downloadHref = `${base}release/latest.zip`;

  useEffect(() => {
    const updateRoute = () => setShouldShowApp(shouldRenderAppRoute());
    window.addEventListener("hashchange", updateRoute);
    window.addEventListener("popstate", updateRoute);
    return () => {
      window.removeEventListener("hashchange", updateRoute);
      window.removeEventListener("popstate", updateRoute);
    };
  }, []);

  if (!shouldShowApp) {
    return <LandingPage appHref={appHref} downloadHref={downloadHref} />;
  }

  return (
    <ErrorBoundary>
      <Suspense
        fallback={
          <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
            <div className="text-sm text-muted-foreground">Loading LLMChef...</div>
          </div>
        }
      >
        <LLMChefApp />
      </Suspense>
    </ErrorBoundary>
  );
}

export default App;
