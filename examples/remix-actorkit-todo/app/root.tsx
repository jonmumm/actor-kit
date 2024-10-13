import { cssBundleHref } from "@remix-run/css-bundle";
import {
  json,
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
} from "@remix-run/react";

import type { LinksFunction, LoaderFunctionArgs } from "@remix-run/cloudflare";
import { createAccessToken, createActorFetch } from "actor-kit/server";
import { SessionProvider } from "./session.context";
import { SessionMachine } from "./session.machine";

export const links: LinksFunction = () => [
  ...(cssBundleHref ? [{ rel: "stylesheet", href: cssBundleHref }] : []),
];

export async function loader({ context }: LoaderFunctionArgs) {
  const fetchSession = createActorFetch<SessionMachine>({
    actorType: "session",
    host: context.env.ACTOR_KIT_HOST,
  });

  const accessToken = await createAccessToken({
    signingKey: context.env.ACTOR_KIT_SECRET,
    actorId: context.sessionId,
    actorType: "session",
    callerId: context.userId,
    callerType: "client",
  });

  const payload = await fetchSession({
    actorId: context.sessionId,
    accessToken,
  });

  return json({
    sessionId: context.sessionId,
    pageSessionId: context.pageSessionId,
    accessToken,
    payload,
    host: context.env.ACTOR_KIT_HOST,
    NODE_ENV: context.env.NODE_ENV,
  });
}

export default function App() {
  const { NODE_ENV, host, sessionId, accessToken, payload } =
    useLoaderData<typeof loader>();
  const isDevelopment = NODE_ENV === "development";

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <SessionProvider
          host={host}
          actorId={sessionId}
          checksum={payload.checksum}
          accessToken={accessToken}
          initialSnapshot={payload.snapshot}
        >
          <Outlet />
        </SessionProvider>
        <ScrollRestoration />
        <Scripts />
        {isDevelopment && <LiveReload />}
      </body>
    </html>
  );
}
