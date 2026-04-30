export type Crea8MemoryScope =
  | "user"
  | "project"
  | "decision"
  | "work-log"
  | "skill"
  | "reference";

export type Crea8MemoryBackend = "markdown-workspace" | "indexeddb" | "api";

export type Crea8MemoryProposalStatus =
  | "draft"
  | "pending"
  | "accepted"
  | "rejected";

export interface Crea8MemorySourceRef {
  conversationId?: string;
  interactionId?: string;
  projectId?: string;
  skillId?: string;
  toolCallId?: string;
}

export interface Crea8MemoryNoteRef {
  backend: Crea8MemoryBackend;
  id: string;
  title: string;
  path?: string;
  url?: string;
}

export interface Crea8MemoryNote {
  id: string;
  title: string;
  content: string;
  scope: Crea8MemoryScope;
  tags: string[];
  projectId?: string | null;
  skillId?: string | null;
  path?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Crea8MemoryProposal {
  id: string;
  status: Crea8MemoryProposalStatus;
  scope: Crea8MemoryScope;
  title: string;
  reason: string;
  proposedContent: string;
  finalContent?: string;
  confidence?: number;
  source: Crea8MemorySourceRef;
  targetNote?: Crea8MemoryNoteRef;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date | null;
}

export interface Crea8MemorySearchQuery {
  text: string;
  scopes?: Crea8MemoryScope[];
  projectId?: string | null;
  skillId?: string | null;
  limit?: number;
}

export interface Crea8MemorySearchResult {
  note: Crea8MemoryNoteRef;
  snippet: string;
  score: number;
  scope: Crea8MemoryScope;
  tags: string[];
}

export interface Crea8MemoryConnector {
  id: string;
  name: string;
  backend: Crea8MemoryBackend;
  search(query: Crea8MemorySearchQuery): Promise<Crea8MemorySearchResult[]>;
  read(ref: Crea8MemoryNoteRef): Promise<Crea8MemoryNote>;
  create(note: Omit<Crea8MemoryNote, "id" | "createdAt" | "updatedAt">): Promise<Crea8MemoryNoteRef>;
  update(ref: Crea8MemoryNoteRef, note: Partial<Crea8MemoryNote>): Promise<Crea8MemoryNoteRef>;
}
