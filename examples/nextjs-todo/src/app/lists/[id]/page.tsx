import { getUserId } from "@/session";
import { createActorFetch } from "actor-kit/server";
import type { TodoMachine } from "../../../server/todo.actor";
import { TodoList } from "./components";
import { TodoActorKitProvider } from "./context";

const fetchTodoActor = createActorFetch<TodoMachine>("todo");

export default async function TodoPage(props: { params: { id: string } }) {
  const listId = props.params.id;
  const userId = await getUserId();

  const host = process.env.ACTOR_KIT_HOST!;
  const signingKey = process.env.ACTOR_KIT_SECRET!;

  const payload = await fetchTodoActor({
    actorId: listId,
    callerId: userId,
    host,
    signingKey, // Signing key stays on the server
  });

  return (
    <TodoActorKitProvider
      options={{
        host,
        actorId: listId,
        connectionId: payload.connectionId,
        connectionToken: payload.connectionToken, // One-time token used on client to get access to the actor
        initialState: payload.snapshot,
      }}
    >
      <TodoList />
    </TodoActorKitProvider>
  );
}
