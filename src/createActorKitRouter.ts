import {
    Request as CFRequest,
    Response as CFResponse,
    DurableObjectNamespace,
    ExecutionContext,
  } from "@cloudflare/workers-types";
  import type { ActorKitMachineServer } from "./types";
  
  type Env = {
    [key: string]: DurableObjectNamespace;
  };
  
  /**
   * Creates a router for handling Actor Kit requests in a Cloudflare Worker.
   * 
   * This router function leverages Durable Objects to provide persistent, globally unique instances for each actor.
   * It implements E-order semantics, ensuring that calls to the same Durable Object are delivered in the order they were made.
   * 
   * @param servers - An object mapping actor types to their respective ActorKitServer classes.
   * 
   * @returns A function that handles routing for Actor Kit requests.
   * 
   * @example
   * // In your wrangler.toml file:
   * [[durable_objects.bindings]]
   * name = "TodoActorKitServer"
   * class_name = "TodoActorKitServer"
   * 
   * // In your Cloudflare Worker script (e.g., src/index.ts):
   * import { WorkerEntrypoint } from "cloudflare:workers";
   * import { createActorKitRouter } from 'actor-kit/worker';
   * import { createMachineServer } from 'actor-kit/worker';
   * import { createTodoMachine } from './todo.machine';
   * import { todoEventSchemas } from './todo.schemas';
   * 
   * // Create the machine server
   * const TodoActorKitServer = createMachineServer(
   *   createTodoMachine,
   *   todoEventSchemas,
   *   { persisted: true }
   * );
   * 
   * // Create the router
   * const actorKitRouter = createActorKitRouter({
   *   todo: TodoActorKitServer,
   * });
   * 
   * // Use the router in a WorkerEntrypoint
   * export default class MyWorker extends WorkerEntrypoint {
   *   async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
   *     const url = new URL(request.url);
   *     
   *     if (url.pathname.startsWith('/api/')) {
   *       return actorKitRouter(request, env, ctx);
   *     }
   *     
   *     // Handle other routes...
   *     return new Response("Hello from MyWorker!");
   *   }
   * }
   * 
   * // Usage:
   * // RPC: env.TODO_ACTOR_KIT_SERVER.get(actorId).addTodo("New task")
   * // HTTP: GET /api/todo/123 will route to the TodoActorKitServer Durable Object with ID "123"
   */
  export const createActorKitRouter = (
    servers: Record<string, ActorKitMachineServer>
  ) => {
    return async (
      request: CFRequest,
      env: Env,
      ctx: ExecutionContext
    ): Promise<CFResponse> => {
      const url = new URL(request.url);
      const pathParts = url.pathname.split("/").filter(Boolean);
  
      // Check if the request is for the API and has exactly three parts
      // Expected format: /api/<actorType>/<actorId>
      if (pathParts.length !== 3 || pathParts[0] !== "api") {
        return new CFResponse("Not Found", { status: 404 });
      }
  
      const [, actorType, actorId] = pathParts;
      const ServerClass = servers[actorType];
  
      // Verify that the requested actor type exists
      if (!ServerClass) {
        return new CFResponse(`Unknown actor type: ${actorType}`, { status: 400 });
      }
  
      // Get the Durable Object namespace for this actor type
      // The naming convention is `${actorType}ActorKitServer`
      const durableObjectNamespace = env[`${actorType}ActorKitServer`] as DurableObjectNamespace;
      if (!durableObjectNamespace) {
        return new CFResponse(
          `Durable Object namespace not found for actor type: ${actorType}`,
          { status: 500 }
        );
      }
  
      // Create a Durable Object ID from the actorId
      // This maps the actorId to a specific Durable Object instance
      const durableObjectId = durableObjectNamespace.idFromString(actorId);
  
      // Get a stub for the Durable Object
      // This stub is a client object used to communicate with the Durable Object instance
      const durableObjectStub = durableObjectNamespace.get(durableObjectId);
  
      // Forward the request to the Durable Object
      // The Durable Object's fetch() method will handle the request
      // This allows the Durable Object to process the request and manage its state
      return durableObjectStub.fetch(request);
    };
  };