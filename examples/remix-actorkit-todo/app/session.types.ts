import type { WithActorKitEvent } from "actor-kit";
import { z } from "zod";
import { SessionClientEventSchema, SessionServiceEventSchema } from "./session.schemas";

export type SessionClientEvent = z.infer<typeof SessionClientEventSchema>;
export type SessionServiceEvent = z.infer<typeof SessionServiceEventSchema>;

export type SessionEvent =
  | WithActorKitEvent<SessionClientEvent, "client">
  | WithActorKitEvent<SessionServiceEvent, "service">;
