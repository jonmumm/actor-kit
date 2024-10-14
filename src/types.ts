import { DurableObject } from "cloudflare:workers";
import type {
  AnyEventObject,
  AnyStateMachine,
  SnapshotFrom,
  StateMachine,
  StateValueFrom,
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
  [key: string]: DurableObjectNamespace<ActorServer<any>> | unknown;
};

export type AnyEvent = z.infer<typeof AnyEventSchema>;
export type BaseEvent = z.infer<typeof BaseEventSchema>;

export interface ActorServerMethods<TMachine extends BaseActorKitStateMachine> {
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

// TMachine extends ActorKitStateMachine<
//   | WithActorKitEvent<TClientEvent, "client">
//   | WithActorKitEvent<TServiceEvent, "service">
//   | ActorKitSystemEvent,
//   WithActorKitInput<TInputProps>,
//   { [key: string]: unknown },
//   { [key: string]: unknown }
// >,

export type ActorServer<TMachine extends AnyActorKitStateMachine> =
  DurableObject & ActorServerMethods<TMachine>;
export type AnyActorServer = ActorServer<any>;

export type Caller = z.infer<typeof CallerSchema>;
export type RequestInfo = z.infer<typeof RequestInfoSchema>;

export type WithIdAndCallerInput = {
  id: string;
  caller: Caller;
  [key: string]: unknown;
};

export type CreateMachineProps = WithIdAndCallerInput;

export type CallerType = "client" | "system" | "service";

type EventObject = {
  type: string;
};

type EventSchemaUnion = z.ZodDiscriminatedUnion<
  "type",
  [
    z.ZodObject<z.ZodRawShape & { type: z.ZodString }>,
    ...z.ZodObject<z.ZodRawShape & { type: z.ZodString }>[]
  ]
>;

export type EventSchemas = {
  client: EventSchemaUnion;
  service: EventSchemaUnion;
};

// Helper type to ensure that all events in EventSchemas have a 'type' property
type EnsureEventHasType<T extends EventSchemas> = {
  [K in keyof T]: T[K] extends z.ZodDiscriminatedUnion<"type", infer Schemas>
    ? z.ZodDiscriminatedUnion<
        "type",
        Schemas extends [z.ZodObject<any>, ...z.ZodObject<any>[]]
          ? [
              z.ZodObject<z.ZodRawShape & { type: z.ZodString }>,
              ...z.ZodObject<z.ZodRawShape & { type: z.ZodString }>[]
            ]
          : never
      >
    : never;
};

// Use this type when defining EventSchemas to ensure type safety
export type SafeEventSchemas = EnsureEventHasType<EventSchemas>;

export type EventWithCaller = {
  type: string;
  [key: string]: unknown;
};

export type ActorKitStateMachine<
  TEvent extends BaseActorKitEvent & EventObject,
  TInput extends { id: string; caller: Caller },
  TPrivateProps extends { [key: string]: unknown },
  TPublicProps extends { [key: string]: unknown }
> = StateMachine<
  {
    public: TPublicProps;
    private: Record<string, TPrivateProps>;
  } & { [key: string]: unknown },
  TEvent, // event
  any, // children
  any, // actor
  any, // action
  any, // guard
  any, // delay
  any, // state value
  any, // tag
  TInput, // input
  any, // tag
  any, // tag
  any, // tag
  any // output
>;

export type BaseActorKitContext<
  TPublicProps extends { [key: string]: unknown },
  TPrivateProps extends { [key: string]: unknown }
> = {
  public: TPublicProps;
  private: Record<string, TPrivateProps>;
};

export type BaseActorKitInput<TInputProps extends { [key: string]: unknown }> =
  TInputProps & {
    id: string;
    caller: Caller;
  };

export type AnyActorKitStateMachine = ActorKitStateMachine<any, any, any, any>;

type AnyActorKitEvent =
  | WithActorKitEvent<AnyEventObject, "client">
  | WithActorKitEvent<AnyEventObject, "service">
  | ActorKitSystemEvent;

export type BaseActorKitStateMachine = ActorKitStateMachine<
  AnyActorKitEvent,
  WithActorKitInput<{ [key: string]: unknown }>,
  { [key: string]: unknown },
  { [key: string]: unknown }
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

export type ActorKitSystemEvent = z.infer<typeof SystemEventSchema>;

// Utility type to merge custom event types with the base event
export type WithActorKitEvent<
  T extends { type: string },
  C extends CallerType
> = T & BaseActorKitEvent & { caller: { type: C } };

export type WithActorKitInput<T extends { [key: string]: unknown }> = T &
  BaseActorKitEvent & { caller: Caller; id: string };

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

export type ClientEventFrom<T extends AnyActorKitStateMachine> =
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

export type ServiceEventFrom<T extends AnyActorKitStateMachine> =
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

export type DurableObjectActor<TMachine extends AnyActorKitStateMachine> =
  ActorServer<TMachine>;

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
export interface MatchesProps<TMachine extends AnyActorKitStateMachine> {
  state: StateValueFrom<TMachine>;
  and?: StateValueFrom<TMachine>;
  or?: StateValueFrom<TMachine>;
  not?: boolean;
  initialValueOverride?: boolean;
}

export type MachineFromServer<T> = T extends ActorServer<infer M> ? M : never;
