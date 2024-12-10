import { z } from "zod";

export const SessionClientEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("NEW_LIST"), listId: z.string() }),
  z.object({ type: z.literal("REGISTER"), email: z.string().email() }),
]);

export const SessionServiceEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("SYNC_LISTS"),
  }),
]);

export const SessionInputPropsSchema = z.object({
  foo: z.string(),
});
