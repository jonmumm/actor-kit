import { SignJWT } from "jose";
import { CallerStringSchema } from "./schemas";
import { CallerType } from "./types";

// Export common types and schemas
export * from "./schemas";
export * from "./types";

// Export utility functions
export const createAccessToken = async ({
  signingKey,
  actorId,
  callerId,
  callerType,
  type,
}: {
  signingKey: string;
  actorId: string;
  callerId: string;
  callerType: CallerType;
  type: string;
}) => {
  const subject = `${callerType}-${callerId}`;
  CallerStringSchema.parse(subject);
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setJti(actorId)
    .setSubject(subject)
    .setAudience(type)
    .setExpirationTime("30d")
    .sign(new TextEncoder().encode(signingKey));
  return token;
};
