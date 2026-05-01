import React, { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { WrenchIcon } from "lucide-react";
import type { SkillsPromptControlModule } from "@/controls/modules/SkillsPromptControlModule";

interface SkillsPromptControlProps {
  module: SkillsPromptControlModule;
}

export const SkillsPromptControl: React.FC<SkillsPromptControlProps> = ({
  module,
}) => {
  const [, forceUpdate] = useState({});

  useEffect(() => {
    module.setNotifyCallback(() => forceUpdate({}));
    void module.loadSkills();
    return () => module.setNotifyCallback(null);
  }, [module]);

  const installedSkills = module.getInstalledSkills();
  const selectedIds = new Set(module.getSelectedSkillIds());
  const selectedCount = selectedIds.size;
  const tooltip = selectedCount
    ? `Skills (${selectedCount} selected)`
    : "Skills";

  const skillsWithPrompts = useMemo(
    () => installedSkills.filter((skill) => skill.manifest.entryPrompt),
    [installedSkills]
  );

  if (installedSkills.length === 0) return null;

  return (
    <Popover>
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant={selectedCount ? "secondary" : "ghost"}
                size="icon"
                className="relative h-8 w-8"
                aria-label={tooltip}
              >
                <WrenchIcon className="h-4 w-4" />
                {selectedCount ? (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
                    {selectedCount}
                  </span>
                ) : null}
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="top">{tooltip}</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <PopoverContent align="start" className="w-[24rem] p-3">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <WrenchIcon className="h-4 w-4 text-muted-foreground" />
              <h4 className="truncate text-sm font-medium">Skills</h4>
            </div>
            <Badge variant="outline">{installedSkills.length} installed</Badge>
          </div>

          {skillsWithPrompts.length === 0 ? (
            <div className="rounded-md border border-dashed p-4 text-xs text-muted-foreground">
              Installed skills need an entry prompt before they can be attached
              to a turn.
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">
                  Selected skill prompts are appended to the next request.
                </span>
                {selectedCount ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-xs"
                    onClick={module.clearSelectedSkills}
                  >
                    Clear
                  </Button>
                ) : null}
              </div>
              <ScrollArea className="h-64 rounded-md border bg-background/50">
                <div className="space-y-1 p-2">
                  {skillsWithPrompts.map((skill) => {
                    const checked = selectedIds.has(skill.id);
                    return (
                      <div
                        key={skill.id}
                        role="button"
                        tabIndex={0}
                        className="flex w-full items-start gap-2 rounded-md border px-2 py-2 text-left hover:bg-muted/60"
                        onClick={() => module.toggleSkill(skill.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            module.toggleSkill(skill.id);
                          }
                        }}
                      >
                        <Checkbox
                          checked={checked}
                          className="mt-0.5"
                          aria-label={`Select ${skill.name}`}
                          onCheckedChange={() => module.toggleSkill(skill.id)}
                          onClick={(event) => event.stopPropagation()}
                        />
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="truncate text-xs font-medium">
                              {skill.name}
                            </span>
                            <Badge variant="outline" className="text-[10px]">
                              {skill.version}
                            </Badge>
                          </div>
                          <p className="line-clamp-2 text-xs text-muted-foreground">
                            {skill.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
