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
import { UserContext } from "./user.context";

export const links: LinksFunction = () => [
  ...(cssBundleHref ? [{ rel: "stylesheet", href: cssBundleHref }] : []),
];

export async function loader({ params, context }: LoaderFunctionArgs) {
  return json({
    userId: context.userId,
    NODE_ENV: context.env.NODE_ENV,
  });
}

export function Layout({ children }: { children: React.ReactNode }) {
  const { userId } = useLoaderData<typeof loader>();
  return <UserContext.Provider value={userId}>{children}</UserContext.Provider>;
}

export default function App() {
  const { NODE_ENV } = useLoaderData<typeof loader>();
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
        <Layout>
          <Outlet />
        </Layout>
        <ScrollRestoration />
        <Scripts />
        {isDevelopment && <LiveReload />}
      </body>
    </html>
  );
}
