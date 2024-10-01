import type { SessionStorage } from "@remix-run/cloudflare";
import { createRequestHandler } from "@remix-run/cloudflare";
import * as build from "@remix-run/dev/server-build";
import { WorkerEntrypoint } from "cloudflare:workers";
import { nanoid } from "nanoid";
import { getServerByName, routePartykitRequest, Server } from "partyserver";

interface Env {
  RemixServer: DurableObjectNamespace<RemixServer>;
  // @ts-expect-error TODO: typescript hell
  TodoActorKitServer: DurableObjectNamespace<SessionStorage>;
}

declare module "@remix-run/cloudflare" {
  interface AppLoadContext {
    env: Env;
    // session: SessionContext<unknown, Env>;
  }
}

const handleRemixRequest = createRequestHandler(build);

export class TodoActorKitServer extends Server {
  async onRequest(request: Request): Promise<Response> {
    return Response.json({ hello: "world" });
  }
}

export class RemixServer extends Server<Env> {
  async fetch(request: Request) {
    return (
      //First let's check if the request is for a party
      // @ts-expect-error TODO: typescript hell
      (await routePartykitRequest(request, this.env)) ||
      // Otherwise let's just handle the request here
      super.fetch(request)
    );
  }

  async onRequest(request: Request): Promise<Response> {
    return handleRemixRequest(request, {
      env: this.env,
    });
  }
}

export default class Worker extends WorkerEntrypoint<Env> {
  async fetch(request: Request) {
    console.log("url", request.url);
    // we need to do this dance just to get the session id
    // from the request to route it to the correct Party

    // const sessionStores = createServerSessionStorage({
    //   // TODO typescript hell
    //   // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    //   namespace: this.env.SessionStorage
    // });

    // TODO: we just need the session id here, can we
    // parse it out of the cookie?
    // const session = await sessionStores.getSession(
    //   request.headers.get("Cookie")
    // );

    if (request.url.includes("/api")) {
    }


    return (await getServerByName(this.env.RemixServer, nanoid())).fetch(
      request
    );
  }
}
