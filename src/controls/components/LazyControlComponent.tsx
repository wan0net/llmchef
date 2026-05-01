import React, { Suspense, type ComponentType } from "react";

export const createLazyControlComponent = <P extends object>(
  loader: () => Promise<{ default: ComponentType<P> }>,
  label = "Loading...",
): React.FC<P> => {
  const LazyComponent = React.lazy(loader);

  const LazyControlComponent: React.FC<P> = (props) => (
    <Suspense
      fallback={
        <div className="p-4 text-sm text-muted-foreground">
          {label}
        </div>
      }
    >
      <LazyComponent {...props} />
    </Suspense>
  );

  return LazyControlComponent;
};
