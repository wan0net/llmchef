import React, { Suspense } from "react";

export const createLazySettingTab = (
  loader: () => Promise<{ default: React.ComponentType }>,
): React.FC => {
  const LazyComponent = React.lazy(loader);

  const LazySettingTab: React.FC = () => (
    <Suspense
      fallback={
        <div className="p-4 text-sm text-muted-foreground">
          Loading settings...
        </div>
      }
    >
      <LazyComponent />
    </Suspense>
  );

  return LazySettingTab;
};
