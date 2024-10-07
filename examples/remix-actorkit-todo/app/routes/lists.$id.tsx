import { LoaderFunctionArgs } from "@remix-run/node";
import { json, useLoaderData } from "@remix-run/react";
import { createAccessToken, createActorFetch } from "actor-kit/server";
import { TodoList } from "../todo.components";
import { TodoActorKitProvider } from "../todo.context";
import type { TodoMachine } from "../todo.machine";

export async function loader({ params, context }: LoaderFunctionArgs) {
  const host = process.env.ACTOR_KIT_HOST!;
  const fetchTodoActor = createActorFetch<TodoMachine>({
    actorType: "todo",
    host,
  });

  const signingKey = process.env.ACTOR_KIT_SECRET!;

  const listId = params.id;
  if (!listId) {
    throw new Error("listId is required");
  }
  // const userId = await getUserId();
  const accessToken = await createAccessToken({
    signingKey,
    actorId: listId,
    actorType: "todo",
    callerId: context.userId,
    callerType: "client",
  });
  const payload = await fetchTodoActor({
    actorId: listId,
    accessToken,
  });
  return json({ listId, accessToken, payload, host });
}

export default function ListPage() {
  const { listId, accessToken, payload, host } = useLoaderData<typeof loader>();

  return (
    <TodoActorKitProvider
      host={host}
      actorId={listId}
      accessToken={accessToken}
      checksum={payload.checksum}
      initialSnapshot={payload.snapshot}
    >
      <TodoList />
    </TodoActorKitProvider>
  );
}
