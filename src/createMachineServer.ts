import { compare } from "fast-json-patch";
import { jwtVerify } from "jose";
import type * as Party from "partykit/server";
import type {
  Actor,
  AnyStateMachine,
  EventFrom,
  SnapshotFrom,
  Subscription,
} from "xstate";
import { createActor, waitFor } from "xstate";
import type { z } from "zod";
import { CallerTypes, PERSISTED_SNAPSHOT_KEY } from "./constants";
import {
  CallerStringSchema,
  EnvironmentSchema,
  RequestInfoSchema,
} from "./schemas";
import type {
  ActorKitStateMachine,
  Caller,
  CallerSnapshotFrom,
  CloudFlareProps,
  CreateMachineProps,
  EventSchemas,
  ExtraContext,
  MachineServerOptions,
} from "./types";
import {
  applyMigrations,
  assert,
  createConnectionToken,
  json,
  loadPersistedSnapshot,
  notFound,
  parseQueryParams,
} from "./utils";

/**
 * createMachineServer
 *
 * This function creates a server for managing actor-based state machines.
 * It provides a framework for handling different types of events from various sources
 * and manages the lifecycle of the actor.
 *
 * @param createMachine A function that creates the state machine. It receives:
 *   - props: An object of type CreateMachineProps, containing id, caller, and any additional properties
 *
 * @param eventSchemas An object containing Zod schemas for different event types:
 *   - client: Schema for events originating from end-users or client applications
 *   - service: Schema for events from trusted external services or internal microservices
 *   - output: Schema for output events that are broadcast to all connected clients
 *   Note: System events are defined internally by Actor Kit and should not be provided here.
 *
 * @param options An optional object containing additional options for the server:
 *   - persisted: A boolean indicating whether the actor's state should be persisted (default: false)
 *
 * @returns An ActorServer class that implements the Party.Server interface
 *
 * Usage Example:
 *
 * import { z } from 'zod';
 * import { createMachineServer } from './createMachineServer';
 *
 * // Define client event schema
 * const clientEventSchema = z.discriminatedUnion('type', [
 *   z.object({ type: z.literal('FORM_SUBMIT'), formData: z.record(z.string()) }),
 *   z.object({ type: z.literal('PAGE_LOADING') }),
 *   z.object({ type: z.literal('PAGE_LOADED') }),
 *   z.object({ type: z.literal('BUTTON_PRESS'), buttonId: z.string() }),
 *   z.object({ type: z.literal('CONNECT') }),
 * ]);
 *
 * // Define service event schema
 * const serviceEventSchema = z.discriminatedUnion('type', [
 *   z.object({ type: z.literal('AUTHENTICATE'), userId: z.string() }),
 *   z.object({ type: z.literal('DATA_SYNC'), data: z.record(z.unknown()) }),
 *   z.object({
 *     type: z.literal('PUSH_NOTIFICATION_RECEIVED'),
 *     notificationId: z.string(),
 *     message: z.string(),
 *     timestamp: z.number()
 *   }),
 * ]);
 *
 * // Define output event schema
 * const outputEventSchema = z.discriminatedUnion('type', [
 *   z.object({ type: z.literal('BROADCAST_MESSAGE'), message: z.string() }),
 *   z.object({ type: z.literal('UPDATE_STATUS'), status: z.string() }),
 * ]);
 *
 * // Define your machine creation function
 * const createMyMachine = (props: CreateMachineProps) => createMachine({
 *   id: `myMachine-${props.id}`,
 *   initial: 'idle',
 *   context: {
 *     caller: props.caller,
 *     notifications: [],
 *     // other context properties
 *   },
 *   states: {
 *     idle: {
 *       on: {
 *         CONNECT: 'connected',
 *         // other transitions
 *       }
 *     },
 *     connected: {
 *       on: {
 *         PUSH_NOTIFICATION_RECEIVED: {
 *           actions: assign({
 *             notifications: (context, event) => [...context.notifications, event]
 *           })
 *         }
 *       }
 *     },
 *     // other states
 *   }
 * });
 *
 * // Create the actor server
 * const MyActorServer = createMachineServer(
 *   createMyMachine,
 *   {
 *     client: clientEventSchema,
 *     service: serviceEventSchema,
 *     output: outputEventSchema,
 *   },
 *   { persisted: true } // enable persistence
 * );
 */

export const createMachineServer = <
  TMachine extends ActorKitStateMachine,
  TEventSchemas extends EventSchemas
>(
  createMachine: (props: CreateMachineProps) => TMachine,
  eventSchemas: TEventSchemas,
  options?: MachineServerOptions
) => {
  const { persisted = false } = options || {};

  class ActorServer implements Party.Server {
    actor: Actor<TMachine> | undefined;
    lastSnapshotsByConnectionId: Map<string, CallerSnapshotFrom<TMachine>>;
    callersByConnectionId: Map<string, Caller>;
    subscrptionsByConnectionId: Map<string, Subscription>;
    lastPersistedSnapshot: SnapshotFrom<TMachine> | null = null;
    extraContext: ExtraContext | undefined;
    #connections: Map<string, Party.Connection> = new Map();

    constructor(public room: Party.Room) {
      this.lastSnapshotsByConnectionId = new Map();
      this.callersByConnectionId = new Map();
      this.subscrptionsByConnectionId = new Map();
    }

    setExtraContext(context: ExtraContext) {
      this.extraContext = context;
    }

    #createAndInitializeActor(props: CreateMachineProps) {
      const machine = createMachine({ ...props } as any);
      const actor = createActor(machine, { input: props } as any);
      if (persisted) {
        this.#setupStatePersistence(actor);
      }
      actor.start();
      return actor;
    }

    #setupStatePersistence(actor: Actor<TMachine>) {
      actor.subscribe((state) => {
        const fullSnapshot = actor.getSnapshot();
        if (fullSnapshot) {
          this.#persistSnapshot(fullSnapshot);
        }
      });
    }

    async #persistSnapshot(snapshot: SnapshotFrom<TMachine>) {
      try {
        if (
          !this.lastPersistedSnapshot ||
          compare(this.lastPersistedSnapshot, snapshot).length > 0
        ) {
          await this.room.storage.put(
            PERSISTED_SNAPSHOT_KEY,
            JSON.stringify(snapshot)
          );
          this.lastPersistedSnapshot = snapshot;
        }
      } catch (error) {
        console.error("Error persisting snapshot:", error);
      }
    }

    #createCallerSnapshot(
      fullSnapshot: SnapshotFrom<TMachine>,
      callerId: string
    ): CallerSnapshotFrom<TMachine> {
      const snap = fullSnapshot as any;
      assert(snap.value, "expected value");
      assert(snap.context.public, "expected public key in context");
      assert(snap.context.private, "expected private key in context");
      return {
        public: snap.context.public,
        private: snap.context.private[callerId] || {},
        value: snap.value,
      };
    }

    async #initializePersistedActor() {
      const parsedSnapshot = await loadPersistedSnapshot(this.room.storage);
      if (!parsedSnapshot) return;

      const systemCaller: Caller = { id: this.room.id, type: "system" };
      const machine = createMachine({
        id: this.room.id,
        caller: systemCaller,
      });
      const restoredSnapshot = applyMigrations(machine, parsedSnapshot);

      this.actor = createActor(machine, {
        snapshot: restoredSnapshot,
        input: { id: this.room.id, caller: systemCaller } as any,
      });
      this.actor.start();

      // Send RESUME event with system as the caller
      this.actor.send({
        type: "RESUME",
        caller: systemCaller,
      } as any);

      this.#setupStatePersistence(this.actor);
    }

    async onStart() {
      if (persisted) {
        await this.#initializePersistedActor();
      }
    }

    async #handleGetRequest(request: Party.Request, caller: Caller) {
      const params = parseQueryParams(request.url);
      const inputJsonString = params.get("input");
      const inputJson = inputJsonString ? JSON.parse(inputJsonString) : {};
      const waitForState = params.get("waitFor");

      const actor = this.#ensureActorRunning({ caller, inputJson });
      const connectionId = crypto.randomUUID();
      this.callersByConnectionId.set(connectionId, caller);
      console.log(this.callersByConnectionId);

      const { ACTOR_KIT_SECRET } = EnvironmentSchema.parse(this.room.env);
      const connectionToken = await createConnectionToken(
        this.room.id,
        connectionId,
        caller.type,
        ACTOR_KIT_SECRET
      );

      if (waitForState) {
        await waitFor(actor, (state) => {
          const anyState = state as SnapshotFrom<AnyStateMachine>;
          return anyState.matches(waitForState);
        });
      }

      const fullSnapshot = actor.getSnapshot();
      const snapshot = this.#createCallerSnapshot(fullSnapshot, caller.id);
      this.lastSnapshotsByConnectionId.set(connectionId, snapshot);

      return json({
        connectionId,
        connectionToken,
        snapshot,
      });
    }

    async #handleEvent(
      event: any,
      caller: Caller,
      schema:
        | z.ZodDiscriminatedUnion<
            "type",
            [z.ZodObject<any>, ...z.ZodObject<any>[]]
          >
        | z.ZodObject<z.ZodRawShape & { type: z.ZodLiteral<string> }>,
      cf?: CloudFlareProps
    ) {
      const parsedEvent = schema.parse(event);
      this.#sendEventToActor(parsedEvent, caller, cf);
    }

    async #handlePostRequest(request: Party.Request, caller: Caller) {
      const jsonObj = await request.json();

      switch (caller.type) {
        case "client":
          await this.#handleEvent(
            jsonObj,
            caller,
            eventSchemas.client,
            request.cf
          );
          break;
        case "service":
          await this.#handleEvent(
            jsonObj,
            caller,
            eventSchemas.service,
            request.cf
          );
          break;
        default:
          throw new Error(
            `Unsupported caller type for POST request: ${caller.type}`
          );
      }

      return json({ status: "ok" });
    }

    async onRequest(request: Party.Request) {
      const { ACTOR_KIT_SECRET } = EnvironmentSchema.parse(this.room.env);
      const caller = await getCallerFromRequest(
        request,
        this.room.name,
        this.room.id,
        ACTOR_KIT_SECRET
      );
      assert(caller, "expected caller to be set");
      console.log("CALLER FROM REQUEST", caller);

      if (request.method === "GET") {
        return this.#handleGetRequest(request, caller);
      } else if (request.method === "POST") {
        return this.#handlePostRequest(request, caller);
      }

      return notFound();
    }

    #ensureActorRunning({
      caller,
      inputJson,
    }: {
      caller: Caller;
      inputJson?: Record<string, unknown>;
    }) {
      if (!this.actor) {
        const props = {
          id: this.room.id,
          caller,
          ...inputJson,
        } as CreateMachineProps;
        this.actor = this.#createAndInitializeActor(props);
      }
      return this.actor;
    }

    async onConnect(
      connection: Party.Connection,
      context: Party.ConnectionContext
    ) {
      const searchParams = new URLSearchParams(
        context.request.url.split("?")[1]
      );
      const token = searchParams.get("token");
      assert(token, "expected connection token when connecting to socket");

      try {
        const { ACTOR_KIT_SECRET } = EnvironmentSchema.parse(this.room.env);
        const { payload } = await parseConnectionToken(token, ACTOR_KIT_SECRET);
        const connectionId = payload.jti;
        assert(connectionId, "expected connectionId from token");
        assert(
          connectionId === connection.id,
          "connectionId from token does not match connection id"
        );

        const caller = this.callersByConnectionId.get(connection.id);
        assert(caller, "expected caller to be set");
        // todo handle instances where caller doesnt exist yet...

        const actor = this.#ensureActorRunning({ caller });

        let lastSnapshot =
          this.lastSnapshotsByConnectionId.get(connection.id) || {};
        const sendSnapshot = (e?: any) => {
          assert(actor, "expected actor reference to exist");
          const fullSnapshot = actor.getSnapshot();
          const nextSnapshot = this.#createCallerSnapshot(
            fullSnapshot,
            caller.id
          );
          const operations = compare(lastSnapshot, nextSnapshot);
          lastSnapshot = nextSnapshot;
          if (operations.length) {
            connection.send(JSON.stringify({ operations }));
          }
          this.lastSnapshotsByConnectionId.set(connection.id, nextSnapshot);
        };
        sendSnapshot();

        let requestInfo: z.infer<typeof RequestInfoSchema> | undefined;
        if (context.request.cf) {
          const result = RequestInfoSchema.safeParse(context.request.cf);
          if (result.success) {
            requestInfo = result.data;
          }
        }

        actor.send({
          type: "CONNECT",
          connectionId: connection.id,
          caller,
          requestInfo,
          parties: this.room.context.parties,
        } as any);

        const sub = actor.subscribe(sendSnapshot);
        this.subscrptionsByConnectionId.set(connection.id, sub);

        console.log(
          `Connected: ${connection.id}, Caller: ${JSON.stringify(caller)}`
        );
      } catch (error) {
        console.error("Error in onConnect:", error);
        connection.close();
      }
    }

    #sendEventToActor(event: any, caller: Caller, cf?: CloudFlareProps) {
      assert(this.actor, "expected actor when sending event");
      const payload = {
        ...event,
        caller,
        cf,
      };
      this.actor.send(payload as EventFrom<TMachine>);
    }

    async onMessage(message: string, sender: Party.Connection) {
      try {
        const parsedMessage = JSON.parse(message);
        const caller = this.callersByConnectionId.get(sender.id);
        console.log({ caller, sender });

        if (!caller) {
          throw new Error(`No caller found for connection ID: ${sender.id}`);
        }

        let schema: z.ZodSchema;
        if (caller.type === CallerTypes.client) {
          schema = eventSchemas.client;
        } else if (caller.type === CallerTypes.service) {
          schema = eventSchemas.service;
        } else {
          throw new Error(`Unsupported caller type: ${caller.type}`);
        }

        const event = schema.parse(parsedMessage);

        this.#ensureActorRunning({
          caller,
          inputJson: {},
        });

        const eventWithContext = {
          ...event,
          context: this.extraContext,
        };

        this.#sendEventToActor(eventWithContext, caller, event.cf);
      } catch (ex) {
        console.warn("Error processing message from client:", ex);
      }
    }

    async onClose(connection: Party.Connection) {
      const sub = this.subscrptionsByConnectionId.get(connection.id);
      if (sub) {
        sub.unsubscribe();
      }

      // Remove the connection
      this.#connections.delete(connection.id);
    }
  }

  return ActorServer satisfies Party.Worker;
};

/**
 * Extracts caller information from a request.
 * This function handles both access token and connection token authentication methods.
 * @param request The incoming request.
 * @param roomName The name of the room (used for token validation).
 * @param roomId The ID of the room (used for token validation).
 * @param callersByConnectionId A map of existing callers by their connection IDs.
 * @returns A Caller object if authentication is successful, undefined otherwise.
 */
const getCallerFromRequest = async (
  request: Party.Request,
  roomName: string,
  roomId: string,
  secret: string
): Promise<Caller | undefined> => {
  const authHeader = request.headers.get("Authorization");
  const accessToken = authHeader?.split(" ")[1];
  assert(accessToken, "expected access token");
  return parseAccessTokenForCaller({
    accessToken,
    type: roomName,
    id: roomId,
    secret,
  });
};

/**
 * Parses and validates an access token to extract caller information.
 * @param accessToken The JWT access token to parse.
 * @param type The expected type of the caller.
 * @param id The expected ID of the actor.
 * @returns A validated Caller object.
 */
const parseAccessTokenForCaller = async ({
  accessToken,
  type,
  id,
  secret,
}: {
  accessToken: string;
  type: string;
  id: string;
  secret: string;
}) => {
  const verified = await jwtVerify(
    accessToken,
    new TextEncoder().encode(secret)
  );
  assert(verified.payload.jti, "expected JTI on accessToken");
  assert(
    verified.payload.jti === id,
    "expected JTI on accessToken to match actor id: " + id
  );
  assert(
    verified.payload.aud,
    "expected accessToken audience to match actor type: " + type
  );
  assert(verified.payload.sub, "expected accessToken to have subject");
  return CallerStringSchema.parse(verified.payload.sub);
};

const parseConnectionToken = async (token: string, secret: string) => {
  const verified = await jwtVerify(token, new TextEncoder().encode(secret));
  assert(verified.payload.jti, "expected JTI on connectionToken");
  return verified;
};
