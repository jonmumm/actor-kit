import { createActorFetch } from "actor-kit/server";
import type { TodoMachine } from "../server/todo.actor";
import { TodoActorKitProvider } from "./context";
import TodoList from "./todolist";

const fetchTodoActor = createActorFetch<TodoMachine>("todo");

export default async function TodoPage() {
  const userId = crypto.randomUUID();
  const payload = await fetchTodoActor({
    actorId: userId,
    callerId: userId,
  });

  return (
    <TodoActorKitProvider
      options={{
        host: process.env.ACTOR_KIT_HOST!,
        actorType: "todo",
        actorId: userId,
        connectionId: payload.connectionId,
        connectionToken: payload.connectionToken,
        initialState: payload.snapshot,
      }}
    >
      <TodoList />
    </TodoActorKitProvider>
  );
}
