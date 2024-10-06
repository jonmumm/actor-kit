import { WithActorKitEvent } from 'actor-kit';
import { z } from 'zod';
import { TodoClientEventSchema, TodoServiceEventSchema } from './todo.schemas';

type TodoClientEvent = z.infer<typeof TodoClientEventSchema>;
type TodoServiceEvent = z.infer<typeof TodoServiceEventSchema>;

export type TodoEvent = WithActorKitEvent<TodoClientEvent, 'client'> | WithActorKitEvent<TodoServiceEvent, 'service'>;
