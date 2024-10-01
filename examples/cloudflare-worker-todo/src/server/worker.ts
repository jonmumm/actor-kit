import { createActorKitRouter } from "actor-kit/worker";
import { TodoActorKitServer } from "../actor/todo.server";

const actorKitRouter = createActorKitRouter({
  todo: TodoActorKitServer,
});

export default {
  fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);

    // Handle Actor Kit routes
    if (url.pathname.startsWith("/api/")) {
      return actorKitRouter(request, env, ctx);
    }

    // Handle other routes or return a default response
    return Promise.resolve(new Response("Welcome to the Todo List API!"));
  },
};

export { TodoActorKitServer };