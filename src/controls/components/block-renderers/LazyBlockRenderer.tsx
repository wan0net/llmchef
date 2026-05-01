import React, { Suspense, type ComponentType } from "react";

export const createLazyBlockRenderer = <P extends object>(
  loader: () => Promise<{ default: ComponentType<P> }>,
  label = "Loading renderer...",
): React.FC<P> => {
  const LazyComponent = React.lazy(loader);

  const LazyBlockRenderer: React.FC<P> = (props) => (
    <Suspense
      fallback={
        <div className="rounded-md border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
          {label}
        </div>
      }
    >
      <LazyComponent {...props} />
    </Suspense>
  );

  return LazyBlockRenderer;
};
