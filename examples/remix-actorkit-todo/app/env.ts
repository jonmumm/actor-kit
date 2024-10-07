import type { ActorServer } from "actor-kit";
import type { TodoServer } from "shared/todo.server";
import type { Remix } from "./server";

declare module "@remix-run/cloudflare" {
  interface AppLoadContext {
    env: Env;
    userId: string;
    sessionId: string;
    pageSessionId: string;
  }
}

export interface Env {
  REMIX: DurableObjectNamespace<Remix>;
  TODO: DurableObjectNamespace<TodoServer>;
  ACTOR_KIT_SECRET: string;
  [key: string]: DurableObjectNamespace<ActorServer<any, any, any>> | unknown;
}
