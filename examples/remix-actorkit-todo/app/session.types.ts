import type {
  ActorKitSystemEvent,
  WithActorKitEvent,
  WithActorKitInput,
} from "actor-kit";
import { z } from "zod";
import {
  SessionClientEventSchema,
  SessionInputPropsSchema,
  SessionServiceEventSchema,
} from "./session.schemas";

export type SessionClientEvent = z.infer<typeof SessionClientEventSchema>;
export type SessionServiceEvent = z.infer<typeof SessionServiceEventSchema>;
export type SessionInputProps = z.infer<typeof SessionInputPropsSchema>;
export type SessionInput = WithActorKitInput<SessionInputProps>;

export type SessionEvent =
  | WithActorKitEvent<SessionClientEvent, "client">
  | WithActorKitEvent<SessionServiceEvent, "service">
  | ActorKitSystemEvent;
