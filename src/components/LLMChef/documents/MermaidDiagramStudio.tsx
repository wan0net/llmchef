import React from "react";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { MermaidBlockRenderer } from "@/components/LLMChef/common/MermaidBlockRenderer";

type MermaidDiagramStudioProps = {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  title?: string;
};

const MermaidDiagramStudioComponent: React.FC<MermaidDiagramStudioProps> = ({
  value,
  onChange,
  readOnly = false,
  title = "Diagram",
}) => {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[minmax(18rem,0.9fr)_minmax(0,1.1fr)]">
      <section className="flex min-h-0 flex-col border-b border-border md:border-b-0 md:border-r">
        <div className="flex h-10 items-center justify-between gap-2 border-b border-border px-3">
          <div className="min-w-0">
            <h4 className="truncate text-xs font-semibold">Mermaid source</h4>
          </div>
          <Badge variant="outline">.mmd</Badge>
        </div>
        <Textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          readOnly={readOnly}
          spellCheck={false}
          className="min-h-0 flex-1 resize-none rounded-none border-0 bg-background p-4 font-mono text-sm shadow-none focus-visible:ring-0"
          aria-label={`Mermaid source for ${title}`}
        />
      </section>
      <section className="flex min-h-0 flex-col">
        <div className="flex h-10 items-center justify-between gap-2 border-b border-border px-3">
          <h4 className="truncate text-xs font-semibold">Diagram preview</h4>
          <Badge variant="secondary">live</Badge>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-4">
          {value.trim() ? (
            <MermaidBlockRenderer code={value} />
          ) : (
            <div className="flex min-h-48 items-center justify-center rounded-md border border-dashed border-border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
              Start writing Mermaid source to render a diagram.
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default React.memo(MermaidDiagramStudioComponent);
