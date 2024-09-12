import type * as Party from "partykit/server";
import type { AnyStateMachine, SnapshotFrom, StateMachine } from "xstate";
import type { z } from "zod";
import type {
  CallerSchema,
  RequestInfoSchema,
  SystemEventSchema,
} from "./schemas";

export type Caller = z.infer<typeof CallerSchema>;
export type RequestInfo = z.infer<typeof RequestInfoSchema>;
export type CloudFlareProps = Party.Request["cf"];

export type PartyMap = Record<
  string,
  {
    get(id: string): Party.Stub;
  }
>;

export type WithIdAndCallerInput = {
  id: string;
  caller: Caller;
  [key: string]: unknown;
};

export type CreateMachineProps<TOutput extends { type: string }> =
  WithIdAndCallerInput & {
    send: (event: OutputEvent<TOutput>) => void;
  };

export type CallerType = "client" | "system" | "service";

export type EventSchemas = {
  client:
    | z.ZodDiscriminatedUnion<"type", [z.ZodObject<any>, ...z.ZodObject<any>[]]>
    | z.ZodObject<z.ZodRawShape & { type: z.ZodLiteral<string> }>;
  service:
    | z.ZodDiscriminatedUnion<"type", [z.ZodObject<any>, ...z.ZodObject<any>[]]>
    | z.ZodObject<z.ZodRawShape & { type: z.ZodLiteral<string> }>;
  output:
    | z.ZodDiscriminatedUnion<"type", [z.ZodObject<any>, ...z.ZodObject<any>[]]>
    | z.ZodObject<z.ZodRawShape & { type: z.ZodLiteral<string> }>;
};

export type EventWithCaller = {
  type: string;
  [key: string]: unknown;
};

export type ActorKitStateMachine<TOutput extends { type: string }> =
  StateMachine<
    {
      public: any;
      history: (OutputEvent<TOutput> & { sentAt: number })[];
    } & {
      [key: string]: unknown;
    },
    any, // event
    any, // children
    any, // actor
    any, // action
    any, // guard
    any, // delay
    any, // state value
    any, // tag
    CreateMachineProps<TOutput>, // input, now including the send function
    any, // tag
    any, // tag
    any, // tag
    any // output
  >;

export type MachineServerOptions = {
  persisted?: boolean;
};

export type ExtraContext = {
  storage: Party.Storage;
  parties: PartyMap;
};

// Base event interface
export interface BaseActorKitEvent {
  caller: Caller;
  parties?: PartyMap;
  requestInfo?: RequestInfo;
  cf?: CloudFlareProps;
}

export type ActorKitSystemEvent = z.infer<typeof SystemEventSchema> & {
  caller: { type: "system" };
};

// Utility type to merge custom event types with the base event
export type WithActorKitEvent<
  T extends { type: string },
  C extends CallerType
> = T & BaseActorKitEvent & { caller: { type: C } };

// New type for output events
export type OutputEvent<T extends { type: string }> = {
  event: T;
  recipients?: Caller[];
};

export type PublicSnapshotFrom<TMachine extends AnyStateMachine> = {
  public: SnapshotFrom<TMachine> extends { context: { public: infer P } }
    ? P
    : unknown;
  value: SnapshotFrom<TMachine> extends { value: infer V } ? V : unknown;
};
