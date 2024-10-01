import { DurableObject, DurableObjectState } from "@cloudflare/workers-types";
import { nanoid } from "nanoid";
import { Actor, AnyStateMachine, createActor } from "xstate";
import { z } from "zod";

// Types
type Caller = {
  id: string;
  type: "client" | "service" | "system";
};

type Connection = WebSocket & {
  id: string;
  caller: Caller;
  state: any;
  setState: (state: any) => void;
};

type EventSchemas = {
  client: z.ZodType<any>;
  service: z.ZodType<any>;
};

type CreateMachineProps = {
  id: string;
  caller: Caller;
};

type ActorKitStateMachine = AnyStateMachine;

type MachineServerOptions = {
  persisted?: boolean;
};

// ActorKitDurableObject
export class ActorKitDurableObject extends DurableObject {
  private connections: Map<string, Connection> = new Map();
  private actor: Actor<any, any, any> | null = null;
  private name: string | undefined;

  constructor(
    private state: DurableObjectState,
    private env: Record<string, unknown>,
    private createMachine: (props: CreateMachineProps) => ActorKitStateMachine,
    private eventSchemas: EventSchemas,
    private options: MachineServerOptions = {}
  ) {
    super(state, env);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    this.name = url.pathname.split("/").pop() || nanoid();

    if (request.headers.get("Upgrade")?.toLowerCase() === "websocket") {
      return this.handleWebSocket(request);
    }

    return this.handleHttpRequest(request);
  }

  private async handleWebSocket(request: Request): Promise<Response> {
    const { 0: client, 1: server } = new WebSocketPair();

    const caller: Caller = await this.authenticateCaller(request);
    const connection = this.wrapWebSocket(server, caller);

    await this.ensureActorRunning(caller);

    server.accept();

    server.addEventListener("message", (event) =>
      this.onMessage(connection, event.data)
    );
    server.addEventListener("close", () => this.onClose(connection));
    server.addEventListener("error", (event) =>
      this.onError(connection, event.error)
    );

    this.connections.set(connection.id, connection);

    return new Response(null, { status: 101, webSocket: client });
  }

  private async handleHttpRequest(request: Request): Promise<Response> {
    const caller = await this.authenticateCaller(request);
    await this.ensureActorRunning(caller);

    // Handle HTTP requests to the actor (e.g., for server-to-server communication)
    const body = await request.json();
    const event = this.validateEvent(body, caller.type);

    if (event) {
      this.actor?.send(event);
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    } else {
      return new Response(JSON.stringify({ error: "Invalid event" }), {
        status: 400,
      });
    }
  }

  private wrapWebSocket(ws: WebSocket, caller: Caller): Connection {
    const connection: Connection = Object.assign(ws, {
      id: nanoid(),
      caller,
      state: null,
      setState: (newState: any) => {
        connection.state = newState;
      },
    });
    return connection;
  }

  private async ensureActorRunning(caller: Caller): Promise<void> {
    if (!this.actor) {
      const machine = this.createMachine({ id: this.name!, caller });

      if (this.options.persisted) {
        const storedState = await this.state.storage.get("actorState");
        this.actor = createActor(machine, { snapshot: storedState }).start();
      } else {
        this.actor = createActor(machine).start();
      }

      this.actor.subscribe((state) => {
        if (this.options.persisted) {
          this.state.storage.put("actorState", state);
        }
        this.broadcastState(state);
      });
    }
  }

  private async authenticateCaller(request: Request): Promise<Caller> {
    // Implement your authentication logic here
    // For now, we'll just create a dummy client caller
    return { id: nanoid(), type: "client" };
  }

  private validateEvent(event: any, callerType: Caller["type"]): any | null {
    try {
      if (callerType === "client") {
        return this.eventSchemas.client.parse(event);
      } else if (callerType === "service") {
        return this.eventSchemas.service.parse(event);
      }
    } catch (error) {
      console.error("Event validation failed:", error);
    }
    return null;
  }

  private onMessage(connection: Connection, data: string | ArrayBuffer): void {
    try {
      const event = JSON.parse(data as string);
      const validatedEvent = this.validateEvent(event, connection.caller.type);
      if (validatedEvent) {
        this.actor?.send(validatedEvent);
      }
    } catch (error) {
      console.error("Error processing message:", error);
    }
  }

  private onClose(connection: Connection): void {
    this.connections.delete(connection.id);
    this.actor?.send({ type: "DISCONNECT", connectionId: connection.id });
  }

  private onError(connection: Connection, error: any): void {
    console.error(`Error on connection ${connection.id}:`, error);
  }

  private broadcastState(state: any): void {
    const message = JSON.stringify({ type: "STATE_UPDATE", state });
    for (const connection of this.connections.values()) {
      connection.send(message);
    }
  }
}

// Helper function to create ActorKitDurableObject
export function createActorKitDurableObject<
  TMachine extends ActorKitStateMachine,
  TEventSchemas extends EventSchemas
>(
  createMachine: (props: CreateMachineProps) => TMachine,
  eventSchemas: TEventSchemas,
  options?: MachineServerOptions
) {
  return class extends ActorKitDurableObject {
    constructor(state: DurableObjectState, env: Record<string, unknown>) {
      super(state, env, createMachine, eventSchemas, options);
    }
  };
}

// Routing function
export async function routeActorKitRequest(
  request: Request,
  env: Record<string, unknown>,
  options?: {
    prefix?: string;
    jurisdiction?: string;
  }
): Promise<Response | null> {
  const url = new URL(request.url);
  const parts = url.pathname.split("/");
  const prefix = options?.prefix || "actors";

  if (parts[1] !== prefix || parts.length < 4) {
    return null;
  }

  const actorType = parts[2];
  const actorId = parts[3];

  const namespace = env[`${actorType}Namespace`] as DurableObjectNamespace;
  if (!namespace) {
    console.error(`No namespace found for actor type: ${actorType}`);
    return new Response("Actor type not found", { status: 404 });
  }

  let id = namespace.idFromName(actorId);
  if (options?.jurisdiction) {
    id = id.jurisdiction(options.jurisdiction);
  }

  const stub = namespace.get(id);
  return stub.fetch(request);
}
