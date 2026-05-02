import type {
  Crea8MemoryConnector,
  Crea8MemoryNote,
  Crea8MemoryNoteRef,
} from "@/types/llmchef/crea8-memory";
import { buildMemoryPromptContext } from "./crea8-memory";

export interface ResolveCrea8MemoryPromptContextInput {
  refs: Crea8MemoryNoteRef[];
  connector: Crea8MemoryConnector;
}

export interface ResolveCrea8MemoryPromptContextResult {
  context: string;
  resolvedRefs: Crea8MemoryNoteRef[];
  failedRefs: Crea8MemoryNoteRef[];
}

export const resolveCrea8MemoryPromptContext = async (
  input: ResolveCrea8MemoryPromptContextInput
): Promise<ResolveCrea8MemoryPromptContextResult> => {
  const notes: Crea8MemoryNote[] = [];
  const resolvedRefs: Crea8MemoryNoteRef[] = [];
  const failedRefs: Crea8MemoryNoteRef[] = [];

  for (const ref of input.refs) {
    try {
      notes.push(await input.connector.read(ref));
      resolvedRefs.push(ref);
    } catch (error) {
      failedRefs.push(ref);
      console.warn("[crea8] Failed to read memory note for prompt context.", {
        ref,
        error,
      });
    }
  }

  return {
    context: notes.length > 0 ? buildMemoryPromptContext(notes) : "",
    resolvedRefs,
    failedRefs,
  };
};
