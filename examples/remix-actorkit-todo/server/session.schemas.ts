import { z } from 'zod';

export const SessionClientEventSchema = z.discriminatedUnion('type', [
	z.object({ type: z.literal('ADD_TODO'), text: z.string() }),
	z.object({ type: z.literal('TOGGLE_TODO'), id: z.string() }),
	z.object({ type: z.literal('DELETE_TODO'), id: z.string() }),
]);

export const SessionServiceEventSchema = z.discriminatedUnion('type', [
	z.object({
		type: z.literal('SYNC_TODOS'),
		todos: z.array(z.object({ id: z.string(), text: z.string(), completed: z.boolean() })),
	}),
]);
