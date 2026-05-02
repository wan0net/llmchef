import React, { useCallback, useEffect, useState } from "react";
import {
  BookOpenTextIcon,
  Loader2Icon,
  SearchIcon,
  XIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useVfsStore } from "@/store/vfs.store";
import type { Crea8MemoryControlModule } from "@/controls/modules/Crea8MemoryControlModule";
import type {
  Crea8MemoryNoteRef,
  Crea8MemorySearchResult,
} from "@/types/llmchef/crea8-memory";

interface Crea8MemoryControlProps {
  module: Crea8MemoryControlModule;
}

const noteLabel = (ref: Crea8MemoryNoteRef): string =>
  ref.title || ref.path || ref.id;

const resultLabel = (result: Crea8MemorySearchResult): string =>
  noteLabel(result.note);

export const Crea8MemoryControl: React.FC<Crea8MemoryControlProps> = ({
  module,
}) => {
  const [, forceUpdate] = useState({});
  const [open, setOpen] = useState(false);
  const fs = useVfsStore((state) => state.fs);
  const configuredVfsKey = useVfsStore((state) => state.configuredVfsKey);
  const vfsKey = useVfsStore((state) => state.vfsKey);
  const vfsLoading = useVfsStore((state) => state.loading);
  const operationLoading = useVfsStore((state) => state.operationLoading);
  const vfsError = useVfsStore((state) => state.error);

  useEffect(() => {
    module.setNotifyCallback(() => forceUpdate({}));
    return () => module.setNotifyCallback(null);
  }, [module]);

  const selectedRefs = module.getSelectedRefs();
  const selectedIds = new Set(selectedRefs.map((ref) => ref.id));
  const query = module.getQuery();
  const results = module.getResults();
  const isSearching = module.getIsSearching();
  const error = module.getError();
  const hasSelection = selectedRefs.length > 0;
  const vfsBusy = vfsLoading || operationLoading;
  const vfsAvailable = Boolean(fs);
  const workspaceLabel = configuredVfsKey ?? vfsKey;

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen);
      if (nextOpen && results.length === 0 && !isSearching) {
        void module.search();
      }
    },
    [isSearching, module, results.length],
  );

  const handleQueryChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      module.setQuery(event.target.value);
    },
    [module],
  );

  const handleSearchSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      void module.search();
    },
    [module],
  );

  const tooltipText = hasSelection
    ? `crea8 Memory (${selectedRefs.length} selected)`
    : "crea8 Memory";

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant={hasSelection ? "secondary" : "ghost"}
                size="icon"
                className="relative h-8 w-8"
                aria-label={tooltipText}
              >
                <BookOpenTextIcon className="h-4 w-4" />
                {hasSelection ? (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
                    {selectedRefs.length}
                  </span>
                ) : null}
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="top">{tooltipText}</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <PopoverContent align="start" className="w-[24rem] p-3">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <BookOpenTextIcon className="h-4 w-4 text-muted-foreground" />
              <h4 className="truncate text-sm font-medium">crea8 Memory</h4>
            </div>
            {workspaceLabel ? (
              <Badge variant="outline" className="max-w-36 truncate">
                {workspaceLabel}
              </Badge>
            ) : null}
          </div>

          <form className="flex gap-2" onSubmit={handleSearchSubmit}>
            <div className="relative min-w-0 flex-1">
              <SearchIcon className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                type="search"
                value={query}
                onChange={handleQueryChange}
                placeholder="Search memory"
                className="h-8 pl-7 text-xs"
              />
            </div>
            <Button
              type="submit"
              size="sm"
              variant="outline"
              className="h-8"
              disabled={isSearching || vfsBusy}
            >
              {isSearching ? (
                <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <SearchIcon className="h-3.5 w-3.5" />
              )}
              Search
            </Button>
          </form>

          {!vfsAvailable ? (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-xs text-muted-foreground">
              No VFS workspace is available.
            </div>
          ) : null}

          {vfsError ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
              VFS error: {vfsError}
            </div>
          ) : null}

          {error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
              {error}
            </div>
          ) : null}

          {selectedRefs.length > 0 ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Selected
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-xs"
                  onClick={module.clearSelectedRefs}
                >
                  Clear
                </Button>
              </div>
              <div className="flex max-h-20 flex-wrap gap-1 overflow-y-auto pr-1">
                {selectedRefs.map((ref) => (
                  <Badge
                    key={ref.id}
                    variant="secondary"
                    className="max-w-full gap-1 pr-1"
                  >
                    <span className="max-w-56 truncate">{noteLabel(ref)}</span>
                    <button
                      type="button"
                      className="rounded-sm p-0.5 hover:bg-muted"
                      aria-label={`Remove ${noteLabel(ref)}`}
                      onClick={() => module.removeRef(ref.id)}
                    >
                      <XIcon className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}

          <ScrollArea className="h-64 rounded-md border bg-background/50">
            <div className="space-y-1 p-2">
              {isSearching ? (
                <div className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground">
                  <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
                  Searching...
                </div>
              ) : results.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  No memory notes found.
                </div>
              ) : (
                results.map((result) => {
                  const checked = selectedIds.has(result.note.id);
                  const title = resultLabel(result);
                  return (
                    <div
                      key={result.note.id}
                      role="button"
                      tabIndex={0}
                      className="flex w-full items-start gap-2 rounded-md border px-2 py-2 text-left hover:bg-muted/60"
                      onClick={() => module.toggleRef(result)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          module.toggleRef(result);
                        }
                      }}
                    >
                      <Checkbox
                        checked={checked}
                        className="mt-0.5"
                        aria-label={`Select ${title}`}
                        onCheckedChange={() => module.toggleRef(result)}
                        onClick={(event) => event.stopPropagation()}
                      />
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="truncate text-xs font-medium">
                            {title}
                          </span>
                          <Badge variant="outline" className="h-5 shrink-0">
                            {result.scope}
                          </Badge>
                        </div>
                        {result.snippet ? (
                          <p className="line-clamp-2 text-xs text-muted-foreground">
                            {result.snippet}
                          </p>
                        ) : null}
                        {result.tags.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {result.tags.slice(0, 4).map((tag) => (
                              <Badge
                                key={tag}
                                variant="secondary"
                                className="h-5 max-w-24 truncate text-[10px]"
                              >
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  );
};
