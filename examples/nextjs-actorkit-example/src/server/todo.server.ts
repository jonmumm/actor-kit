import { createMachineServer } from "actor-kit/worker";
import { createTodoListMachine } from "./todo.actor";
import { TodoClientEventSchema, TodoServiceEventSchema } from "./todo.schemas";

const TodoListServer = createMachineServer(
  createTodoListMachine,
  {
    client: TodoClientEventSchema,
    service: TodoServiceEventSchema,
  },
  {
    persisted: true,
  }
);

export default TodoListServer;
