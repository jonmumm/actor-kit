import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/cloudflare";
import { json, useLoaderData } from "@remix-run/react";

export const meta: MetaFunction = () => {
  return [
    { title: "Remix + ActorKit Todo" },
    {
      name: "description",
      content: "Welcome to Remix! Using Vite and Cloudflare Workers!",
    },
  ];
};

export const loader = async (args: LoaderFunctionArgs) => {
  const listId = crypto.randomUUID();
  return json({ listId });
};

export default function Homepage() {
  const { listId } = useLoaderData<typeof loader>();

  return (
    <a href={`/lists/${listId}`}>
      <button>New List</button>
    </a>
  );
}
