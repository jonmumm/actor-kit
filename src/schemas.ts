import { z } from "zod";

export const BotManagementSchema = z.object({
  corporateProxy: z.boolean(),
  verifiedBot: z.boolean(),
  jsDetection: z.object({
    passed: z.boolean(),
  }),
  staticResource: z.boolean(),
  detectionIds: z.record(z.any()),
  score: z.number(),
});

export const EnvironmentSchema = z.object({
  ACTOR_KIT_SECRET: z.string(),
  ACTOR_KIT_HOST: z.string(),
});

export const RequestInfoSchema = z.object({
  longitude: z.string(),
  latitude: z.string(),
  continent: z.string(),
  country: z.string(),
  city: z.string(),
  timezone: z.string(),
  postalCode: z.string(),
  region: z.string(),
  regionCode: z.string(),
  metroCode: z.string(),
  botManagement: BotManagementSchema,
});

export const CallerSchema = z.object({
  id: z.string(),
  type: z.enum(["client", "system", "service"]),
});

export const AnyEventSchema = z.object({
  type: z.string(),
});

export const BaseEventSchema = AnyEventSchema.extend({
  caller: CallerSchema,
});

export const SystemEventSchema = z.discriminatedUnion("type", [
  z.object({ 
    type: z.literal("INITIALIZE"),
    caller: z.object({ type: z.literal("system"), id: z.string() })
  }),
  z.object({ 
    type: z.literal("CONNECT"),
    caller: z.object({ type: z.literal("system"), id: z.string() }),
    connectingCaller: CallerSchema
  }),
  z.object({ 
    type: z.literal("DISCONNECT"),
    caller: z.object({ type: z.literal("system"), id: z.string() }),
    disconnectingCaller: CallerSchema
  }),
  z.object({ 
    type: z.literal("RESUME"),
    caller: z.object({ type: z.literal("system"), id: z.string() })
  }),
  z.object({ 
    type: z.literal("MIGRATE"),
    caller: z.object({ type: z.literal("system"), id: z.string() }),
    operations: z.array(z.any())
  }),
]);

export const CallerIdTypeSchema = z.enum(["client", "service", "system"]);

export const CallerStringSchema = z.string().transform((val, ctx) => {
  if (val === "anonymous") {
    return { type: "client" as const, id: "anonymous" };
  }

  // Regular expression to validate the UUID format
  const callerTypeParseResult = CallerIdTypeSchema.safeParse(val.split("-")[0]);
  if (!callerTypeParseResult.success) {
    callerTypeParseResult.error.issues.forEach(ctx.addIssue);
    return z.NEVER;
  }
  const type = callerTypeParseResult.data;

  const id = val.substring(val.indexOf("-") + 1);
  if (z.string().uuid().safeParse(id).success) {
    return { type, id };
  } else {
    // If not valid, add a custom issue
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Must be a valid uuid or 'anonymous'. Received '${id}' on value '${val}'.`,
    });
    // Return the special NEVER symbol to indicate a validation failure
    return z.NEVER;
  }
});
