import { CallerType } from "./types";

/**
 * Defines the types of callers that can interact with the actor system.
 * Each type represents a different source of events with varying levels of trust and permissions.
 * Note: SYSTEM events are handled internally by Actor Kit and are not defined by the user.
 */
export const CallerTypes: Record<CallerType, CallerType> = {
  client: "client",
  system: "system", // Handled internally by Actor Kit
  service: "service",
};

export const PERSISTED_SNAPSHOT_KEY = "persistedSnapshot";
