import { getUserId } from "@/session";
import { createActorFetch } from "actor-kit/server";
import type { TodoMachine } from "../../../server/todo.actor";
import { TodoList } from "./components";
import { TodoActorKitProvider } from "./context";

const fetchTodoActor = createActorFetch<TodoMachine>("todo");

export default async function TodoPage(props: { params: { id: string } }) {
  const listId = props.params.id;
  const userId = await getUserId();

  const payload = await fetchTodoActor({
    actorId: listId,
    callerId: userId,
  });

  return (
    <TodoActorKitProvider
      options={{
        host: process.env.ACTOR_KIT_HOST!,
        actorType: "todo",
        actorId: listId,
        connectionId: payload.connectionId,
        connectionToken: payload.connectionToken,
        initialState: payload.snapshot,
      }}
    >
      <TodoList />
    </TodoActorKitProvider>
  );
}
