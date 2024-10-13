import { z } from "zod";

export const SessionClientEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("NEW_LIST"), listId: z.string() }),
]);

export const SessionServiceEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("SYNC_LISTS"),
  }),
]);
