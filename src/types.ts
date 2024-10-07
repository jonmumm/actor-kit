import { DurableObject } from "cloudflare:workers";
import type {
  AnyEventObject,
  AnyStateMachine,
  SnapshotFrom,
  StateMachine,
} from "xstate";
import type { z } from "zod";
import type {
  AnyEventSchema,
  BaseEventSchema,
  CallerSchema,
  RequestInfoSchema,
  SystemEventSchema,
} from "./schemas";

export type EnvWithDurableObjects = {
  ACTOR_KIT_SECRET: string;
  [key: string]: DurableObjectNamespace<ActorServer<any, any, any>> | unknown;
};

export type AnyEvent = z.infer<typeof AnyEventSchema>;
export type BaseEvent = z.infer<typeof BaseEventSchema>;

export interface ActorServerMethods<TMachine extends ActorKitStateMachine> {
  fetch(request: Request): Promise<Response>;
  spawn(props: {
    actorType: string;
    actorId: string;
    caller: Caller;
    input: Record<string, unknown>;
  }): void;
  send(event: ClientEventFrom<TMachine> | ServiceEventFrom<TMachine>): void;
  getSnapshot(caller: Caller): {
    checksum: string;
    snapshot: CallerSnapshotFrom<TMachine>;
  };
}

export type ActorServer<
  TMachine extends ActorKitStateMachine,
  TEventSchemas extends EventSchemas,
  Env
> = DurableObject & ActorServerMethods<TMachine>;
export type AnyActorServer = ActorServer<any, any, any>;

export type Caller = z.infer<typeof CallerSchema>;
export type RequestInfo = z.infer<typeof RequestInfoSchema>;

export type WithIdAndCallerInput = {
  id: string;
  caller: Caller;
  [key: string]: unknown;
};

export type CreateMachineProps = WithIdAndCallerInput;

export type CallerType = "client" | "system" | "service";

export type EventSchemas = {
  client:
    | z.ZodDiscriminatedUnion<"type", [z.ZodObject<any>, ...z.ZodObject<any>[]]>
    | z.ZodObject<z.ZodRawShape & { type: z.ZodLiteral<string> }>;
  service:
    | z.ZodDiscriminatedUnion<"type", [z.ZodObject<any>, ...z.ZodObject<any>[]]>
    | z.ZodObject<z.ZodRawShape & { type: z.ZodLiteral<string> }>;
};

export type EventWithCaller = {
  type: string;
  [key: string]: unknown;
};

type ActorKitEvent =
  | WithActorKitEvent<AnyEventObject, "client">
  | WithActorKitEvent<AnyEventObject, "service">
  | ActorKitSystemEvent;

export type ActorKitStateMachine = StateMachine<
  {
    public: any;
    private: Record<string, any>;
  } & {
    [key: string]: unknown;
  },
  // ActorKitEvent, // event
  any, // event
  any, // children
  any, // actor
  any, // action
  any, // guard
  any, // delay
  any, // state value
  any, // tag
  CreateMachineProps, // input
  any, // tag
  any, // tag
  any, // tag
  any // output
>;

export type MachineServerOptions = {
  persisted?: boolean;
};

export type ExtraContext = {
  requestId: string;
};

// Base event interface
export interface BaseActorKitEvent {
  caller: Caller;
  requestInfo?: RequestInfo;
  // cf?: CloudFlareProps;
}

export type ActorKitSystemEvent = z.infer<typeof SystemEventSchema> & {
  caller: { type: "system" };
};

// Utility type to merge custom event types with the base event
export type WithActorKitEvent<
  T extends { type: string },
  C extends CallerType
> = T & BaseActorKitEvent & { caller: { type: C } };

export type CallerSnapshotFrom<TMachine extends AnyStateMachine> = {
  public: SnapshotFrom<TMachine> extends { context: { public: infer P } }
    ? P
    : unknown;
  private: SnapshotFrom<TMachine> extends {
    context: { private: Partial<Record<string, infer PR>> };
  }
    ? PR
    : unknown;
  value: SnapshotFrom<TMachine> extends { value: infer V } ? V : unknown;
};

export type ClientEventFrom<T extends ActorKitStateMachine> =
  T extends StateMachine<
    any,
    infer TEvent,
    any,
    any,
    any,
    any,
    any,
    any,
    any,
    any,
    any,
    any,
    any,
    any
  >
    ? TEvent extends WithActorKitEvent<infer E, "client">
      ? E
      : never
    : never;

export type ServiceEventFrom<T extends ActorKitStateMachine> =
  T extends StateMachine<
    any,
    infer TEvent,
    any,
    any,
    any,
    any,
    any,
    any,
    any,
    any,
    any,
    any,
    any,
    any
  >
    ? TEvent extends WithActorKitEvent<infer E, "service">
      ? E
      : never
    : never;

// Helper type to convert from SCREAMING_SNAKE_CASE to kebab-case
export type ScreamingSnakeToKebab<S extends string> =
  S extends `${infer T}_${infer U}`
    ? `${Lowercase<T>}-${ScreamingSnakeToKebab<U>}`
    : Lowercase<S>;

export type DurableObjectActor<TMachine extends ActorKitStateMachine> =
  ActorServer<TMachine, any, any>;

type CamelToSnakeCase<S extends string> = S extends `${infer T}${infer U}`
  ? U extends Uncapitalize<U>
    ? `${Lowercase<T>}${CamelToSnakeCase<U>}`
    : `${Lowercase<T>}_${CamelToSnakeCase<U>}`
  : S;

type KebabToCamelCase<S extends string> = S extends `${infer T}-${infer U}`
  ? `${T}${Capitalize<KebabToCamelCase<U>>}`
  : S;

export type KebabToScreamingSnake<S extends string> = Uppercase<
  CamelToSnakeCase<KebabToCamelCase<S>>
>;
