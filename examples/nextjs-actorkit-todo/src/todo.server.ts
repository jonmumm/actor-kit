import { createMachineServer } from 'actor-kit/worker';
import { createTodoListMachine } from './todo.machine';
import { TodoClientEventSchema, TodoServiceEventSchema } from './todo.schemas';

export const Todo = createMachineServer({
	createMachine: createTodoListMachine,
	eventSchemas: {
		client: TodoClientEventSchema,
		service: TodoServiceEventSchema,
	},
	options: {
		persisted: true,
	},
});

export type TodoServer = InstanceType<typeof Todo>;
export default Todo;
