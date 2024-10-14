import { createMachineServer } from "actor-kit/worker";
import { z } from "zod";
import { createTodoListMachine } from "./todo.machine";
import { TodoClientEventSchema, TodoServiceEventSchema } from "./todo.schemas";

export const Todo = createMachineServer({
  createMachine: createTodoListMachine,
  schemas: {
    client: TodoClientEventSchema,
    service: TodoServiceEventSchema,
    input: z.object({
      foo: z.string(),
    }),
  },
  options: {
    persisted: true,
  },
});

export type TodoServer = InstanceType<typeof Todo>;
export default Todo;
