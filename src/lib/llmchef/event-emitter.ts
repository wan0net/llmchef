// src/lib/llmchef/event-emitter.ts
// FULL FILE
import mitt, { type Emitter } from "mitt";
import type { ModEventPayloadMap } from "@/types/llmchef/modding";

// Ensure ModEventPayloadMap is compatible with Record<EventType, any>
// This explicitly tells mitt that our event names (which are strings) map to some payload.
export const emitter: Emitter<ModEventPayloadMap> = mitt<ModEventPayloadMap>();
