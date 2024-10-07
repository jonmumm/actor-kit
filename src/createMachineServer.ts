// Import necessary dependencies and types
import { DurableObject } from "cloudflare:workers";
import { compare } from "fast-json-patch";
import { Actor, createActor, SnapshotFrom, Subscription } from "xstate";
import { z } from "zod";
import { CallerSchema } from "./schemas";
import {
  ActorKitStateMachine,
  ActorServer,
  Caller,
  CallerSnapshotFrom,
  ClientEventFrom,
  CreateMachineProps,
  EventSchemas,
  MachineServerOptions,
  ServiceEventFrom,
} from "./types";
import { assert, getCallerFromRequest } from "./utils";

// Define schemas for storage and WebSocket attachments
const StorageSchema = z.object({
  actorType: z.string(),
  actorId: z.string(),
  initialCaller: CallerSchema,
});

const WebSocketAttachmentSchema = z.object({
  caller: CallerSchema,
});
type WebSocketAttachment = z.infer<typeof WebSocketAttachmentSchema>;

/**
 * Creates a MachineServer class that extends DurableObject and implements ActorServer.
 * This function is the main entry point for creating a machine server.
 */
export const createMachineServer = <
  TMachine extends ActorKitStateMachine,
  TEventSchemas extends EventSchemas,
  Env extends { ACTOR_KIT_SECRET: string }
>({
  createMachine,
  eventSchemas,
  options,
}: {
  createMachine: (props: CreateMachineProps) => TMachine;
  eventSchemas: TEventSchemas;
  options?: MachineServerOptions;
}): new (
  state: DurableObjectState,
  env: Env,
  ctx: ExecutionContext
) => ActorServer<TMachine, TEventSchemas, Env> =>
  class MachineServerImpl
    extends DurableObject
    implements ActorServer<TMachine, TEventSchemas, Env>
  {
    // Class properties
    actor: Actor<TMachine> | undefined;
    actorType: string | undefined;
    actorId: string | undefined;
    input: Record<string, unknown> | undefined;
    initialCaller: Caller | undefined;
    lastPersistedSnapshot: SnapshotFrom<TMachine> | null = null;
    lastSnapshotChecksum: string | null = null;
    snapshotCache: Map<string, { snapshot: SnapshotFrom<TMachine>, timestamp: number }> = new Map();
    state: DurableObjectState;
    storage: DurableObjectStorage;
    attachments: Map<WebSocket, WebSocketAttachment>;
    subscriptions: Map<WebSocket, Subscription>;
    env: Env;
    currentChecksum: string | null = null;

    /**
     * Constructor for the MachineServerImpl class.
     * Initializes the server and sets up WebSocket connections.
     */
    constructor(state: DurableObjectState, env: Env, ctx: ExecutionContext) {
      super(state, env);
      this.state = state;
      this.storage = state.storage;
      this.env = env;
      this.attachments = new Map();
      this.subscriptions = new Map();

      // Set up WebSocket attachments
      this.state.getWebSockets().forEach((ws) => {
        const attachment = WebSocketAttachmentSchema.parse(
          ws.deserializeAttachment()
        );
        this.attachments.set(ws, attachment);
      });

      // Initialize actor data from storage
      this.state.blockConcurrencyWhile(async () => {
        const [actorType, actorId, initialCallerString, inputString] =
          await Promise.all([
            this.storage.get("actorType"),
            this.storage.get("actorId"),
            this.storage.get("initialCaller"),
            this.storage.get("input"),
          ]);

        if (actorType && actorId && initialCallerString && inputString) {
          try {
            const parsedData = StorageSchema.parse({
              actorType,
              actorId,
              initialCaller: JSON.parse(
                initialCallerString as string
              ) as Caller,
            });

            this.actorType = parsedData.actorType;
            this.actorId = parsedData.actorId;
            this.initialCaller = parsedData.initialCaller;
            this.input = JSON.parse(inputString as string);
            // Ensure the actor is running
            this.#ensureActorRunning();
          } catch (error) {
            console.error("Failed to parse stored data:", error);
          }
        }
      });

      this.#startPeriodicCacheCleanup();
    }

    /**
     * Ensures that the actor is running. If not, it creates and initializes the actor.
     * @private
     */
    #ensureActorRunning() {
      assert(this.actorId, "actorId is not set");
      assert(this.actorType, "actorType is not set");
      assert(this.input, "input is not set");
      assert(this.initialCaller, "initialCaller is not set");

      if (!this.actor) {
        const props = {
          id: this.actorId,
          caller: this.initialCaller,
          ...this.input,
        } as CreateMachineProps;
        this.actor = this.#createAndInitializeActor(props);

        // Set up subscription to send diffs to clients
        // We don't worry about the unsubscribe here because
        // we know this is only run once per instance lifetime...
        this.actor.subscribe(() => {
          const fullSnapshot = this.actor!.getSnapshot();
          const checksum = this.#calculateChecksum(fullSnapshot);
          this.currentChecksum = checksum;  // Add this line
          this.snapshotCache.set(checksum, { snapshot: fullSnapshot, timestamp: Date.now() });
          this.#scheduleSnapshotCacheCleanup(checksum);
          
          let lastCallerSnapshot: CallerSnapshotFrom<TMachine> | {};
          this.attachments.forEach((attachment, ws) => {
            const { caller } = attachment;

            const nextSnapshot = this.#createCallerSnapshot(
              fullSnapshot,
              caller.id
            );

            const operations = compare(lastCallerSnapshot, nextSnapshot);

            if (operations.length) {
              ws.send(JSON.stringify({ operations, checksum }));
            }
            lastCallerSnapshot = nextSnapshot;
          });
        });
      }
      return this.actor;
    }

    /**
     * Creates and initializes an actor with the given properties.
     * @private
     */
    #createAndInitializeActor(props: CreateMachineProps) {
      const machine = createMachine({ ...props } as any);
      const actor = createActor(machine, { input: props } as any);
      if (options?.persisted) {
        this.#setupStatePersistence(actor);
      }
      actor.start();
      return actor;
    }

    /**
     * Sets up state persistence for the actor if the persisted option is enabled.
     * @private
     */
    #setupStatePersistence(actor: Actor<TMachine>) {
      actor.subscribe((state) => {
        const fullSnapshot = actor.getSnapshot();
        if (fullSnapshot) {
          this.#persistSnapshot(fullSnapshot);
        }
      });
    }

    /**
     * Persists the given snapshot if it's different from the last persisted snapshot.
     * @private
     */
    async #persistSnapshot(snapshot: SnapshotFrom<TMachine>) {
      try {
        if (
          !this.lastPersistedSnapshot ||
          compare(this.lastPersistedSnapshot, snapshot).length > 0
        ) {
          // TODO: Implement actual persistence logic
          // await this.room.storage.put(
          //   PERSISTED_SNAPSHOT_KEY,
          //   JSON.stringify(snapshot)
          // );
          this.lastPersistedSnapshot = snapshot;
        }
      } catch (error) {
        console.error("Error persisting snapshot:", error);
      }
    }

    /**
     * Handles incoming HTTP requests and sets up WebSocket connections.
     */
    async fetch(request: Request): Promise<Response> {
      const actor = this.actor;
      assert(this.actorType, "actorType is not set");
      assert(this.actorId, "actorId is not set");
      assert(actor, "actor is not set");

      const webSocketPair = new WebSocketPair();
      const [client, server] = Object.values(webSocketPair);

      let caller: Caller | undefined;
      try {
        caller = await getCallerFromRequest(
          request,
          this.actorType,
          this.actorId,
          this.env.ACTOR_KIT_SECRET
        );
      } catch (error: any) {
        return new Response(`Error: ${error.message}`, { status: 401 });
      }

      if (!caller) {
        return new Response("Unauthorized", { status: 401 });
      }

      this.state.acceptWebSocket(server);
      this.attachments.set(server, { caller });

      // Parse the checksum from the request, if provided
      const url = new URL(request.url);
      const clientChecksum = url.searchParams.get("checksum");

      const fullSnapshot = actor.getSnapshot();
      const currentChecksum = this.#calculateChecksum(fullSnapshot);

      let lastSnapshot = {};
      if (clientChecksum) {
        const cachedData = this.snapshotCache.get(clientChecksum);
        if (cachedData) {
          lastSnapshot = this.#createCallerSnapshot(cachedData.snapshot, caller.id);
        }
        // Schedule cleanup for this checksum
        this.#scheduleSnapshotCacheCleanup(clientChecksum);
      }

      // Send initial diff if necessary
      if (!clientChecksum || clientChecksum !== currentChecksum) {
        const initialNextSnapshot = this.#createCallerSnapshot(fullSnapshot, caller.id);
        const initialOperations = compare(lastSnapshot, initialNextSnapshot);

        if (initialOperations.length) {
          server.send(JSON.stringify({ operations: initialOperations, checksum: currentChecksum }));
        }
        lastSnapshot = initialNextSnapshot;
      }

      const sub = actor.subscribe(() => {
        assert(actor, "actor is not running");
        const fullSnapshot = actor.getSnapshot();
        const checksum = this.#calculateChecksum(fullSnapshot);
        const nextSnapshot = this.#createCallerSnapshot(fullSnapshot, caller.id);
        const operations = compare(lastSnapshot, nextSnapshot);

        if (operations.length) {
          server.send(JSON.stringify({ operations, checksum }));
        }
        // Update lastSnapshot for future comparisons
        lastSnapshot = nextSnapshot;
      });
      this.subscriptions.set(server, sub);

      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }

    /**
     * Handles incoming WebSocket messages.
     */
    async webSocketMessage(ws: WebSocket, message: ArrayBuffer | string) {
      const attachment = this.attachments.get(ws);
      assert(attachment, "Attachment missing for WebSocket");

      let event: ClientEventFrom<TMachine> | ServiceEventFrom<TMachine>;

      const { caller } = attachment;
      if (caller.type === "client") {
        const clientEvent = eventSchemas.client.parse(
          JSON.parse(message as string)
        );
        event = {
          ...clientEvent,
          caller,
        } as ClientEventFrom<TMachine>;
      } else if (caller.type === "service") {
        const serviceEvent = eventSchemas.client.parse(
          JSON.parse(message as string)
        );
        event = {
          ...serviceEvent,
          caller,
        } as ClientEventFrom<TMachine>;
      } else {
        throw new Error(`Unknown caller type: ${caller.type}`);
      }

      this.send(event);
    }

    /**
     * Handles WebSocket errors.
     */
    async webSocketError(ws: WebSocket, error: Error) {
      console.error(
        "[MachineServerImpl] WebSocket error:",
        error.message,
        error.stack
      );
    }

    /**
     * Handles WebSocket closure.
     */
    async webSocketClose(
      ws: WebSocket,
      code: number,
      reason: string,
      wasClean: boolean
    ) {
      ws.close(code, "Durable Object is closing WebSocket");
      // Remove the subscription for the socket
      const subscription = this.subscriptions.get(ws);
      if (subscription) {
        subscription.unsubscribe();
        this.subscriptions.delete(ws);
      }
      // Remove the attachment for the socket
      this.attachments.delete(ws);
    }

    /**
     * Sends an event to the actor.
     */
    send(event: ClientEventFrom<TMachine> | ServiceEventFrom<TMachine>): void {
      assert(this.actor, "Actor is not running");
      this.actor.send(event);
    }

    /**
     * Retrieves a snapshot of the actor's state for a specific caller.
     * @param caller The caller requesting the snapshot.
     * @returns An object containing the caller-specific snapshot and a checksum for the full snapshot.
     */
    getSnapshot(caller: Caller) {
      assert(this.actor, "Actor is not running");
      const fullSnapshot = this.actor.getSnapshot();

      const checksum = this.#calculateChecksum(fullSnapshot);
      this.snapshotCache.set(checksum, { snapshot: fullSnapshot, timestamp: Date.now() });

      // Schedule cleanup for this checksum
      this.#scheduleSnapshotCacheCleanup(checksum);

      const snapshot = this.#createCallerSnapshot(fullSnapshot, caller.id);
      return {
        snapshot,
        checksum,
      };
    }

    /**
     * Calculates a checksum for the given snapshot.
     * @private
     */
    #calculateChecksum(snapshot: SnapshotFrom<TMachine>): string {
      const snapshotString = JSON.stringify(snapshot);
      return this.#hashString(snapshotString);
    }

    /**
     * Generates a simple hash for a given string.
     * @private
     */
    #hashString(str: string): string {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      return hash.toString(16); // Convert to hexadecimal
    }

    /**
     * Creates a caller-specific snapshot from the full snapshot.
     * @private
     */
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

    /**
     * Spawns a new actor with the given properties.
     */
    async spawn(props: {
      actorType: string;
      actorId: string;
      caller: Caller;
      input: Record<string, unknown>;
    }) {
      if (!this.actorType && !this.actorId && !this.initialCaller) {
        // Store actor data in storage
        await Promise.all([
          this.storage.put("actorType", props.actorType),
          this.storage.put("actorId", props.actorId),
          this.storage.put("initialCaller", JSON.stringify(props.caller)),
          this.storage.put("input", JSON.stringify(props.input)),
        ]).catch((error) => {
          console.error("Error storing actor data:", error);
        });

        // Update the instance properties
        this.actorType = props.actorType;
        this.actorId = props.actorId;
        this.initialCaller = props.caller;
        this.input = props.input;

        this.#ensureActorRunning();
      }
    }

    // New method for scheduling snapshot cache cleanup
    #scheduleSnapshotCacheCleanup(checksum: string) {
      const CLEANUP_DELAY = 300000; // 5 minutes, adjust as needed
      setTimeout(() => {
        this.#cleanupSnapshotCache(checksum);
      }, CLEANUP_DELAY);
    }

    // New method for periodic cache cleanup
    #startPeriodicCacheCleanup() {
      const CLEANUP_INTERVAL = 300000; // 5 minutes, adjust as needed
      setInterval(() => {
        const now = Date.now();
        for (const [checksum, { timestamp }] of this.snapshotCache.entries()) {
          if (now - timestamp > CLEANUP_INTERVAL) {
            this.snapshotCache.delete(checksum);
          }
        }
      }, CLEANUP_INTERVAL);
    }

    // New method for cleaning up snapshot cache
    #cleanupSnapshotCache(checksum: string) {
      if (checksum !== this.currentChecksum) {
        const cachedData = this.snapshotCache.get(checksum);
        if (cachedData) {
          const now = Date.now();
          if (now - cachedData.timestamp > 300000) { // 5 minutes, same as CLEANUP_DELAY
            this.snapshotCache.delete(checksum);
          }
        }
      }
    }
  };