import { jwtVerify, SignJWT } from "jose";
import type * as Party from "partykit/server";
import { assert } from "./misc";
import { CallerStringSchema } from "../schemas";
import type { Caller, CallerType } from "../types";
import { parseQueryParams } from "./query-params";

/**
 * Parses and validates an access token to extract caller information.
 * @param accessToken The JWT access token to parse.
 * @param type The expected type of the caller.
 * @param id The expected ID of the actor.
 * @returns A validated Caller object.
 */
export const parseAccessTokenForCaller = async ({
  accessToken,
  type,
  id,
  secret,
}: {
  accessToken: string;
  type: string;
  id: string;
  secret: string;
}) => {
  const verified = await jwtVerify(
    accessToken,
    new TextEncoder().encode(secret)
  );
  assert(verified.payload.jti, "expected JTI on accessToken");
  assert(
    verified.payload.jti === id,
    "expected JTI on accessToken to match actor id: " + id
  );
  assert(
    verified.payload.aud,
    "expected accessToken audience to match actor type: " + type
  );
  assert(verified.payload.sub, "expected accessToken to have subject");
  return CallerStringSchema.parse(verified.payload.sub);
};

/**
 * Extracts caller information from a request.
 * This function handles both access token and connection token authentication methods.
 * @param request The incoming request.
 * @param roomName The name of the room (used for token validation).
 * @param roomId The ID of the room (used for token validation).
 * @param callersByConnectionId A map of existing callers by their connection IDs.
 * @returns A Caller object if authentication is successful, undefined otherwise.
 */
export const getCallerFromRequest = async (
  request: Party.Request,
  roomName: string,
  roomId: string,
  callersByConnectionId: Map<string, Caller>,
  secret: string
): Promise<Caller | undefined> => {
  const authHeader = request.headers.get("Authorization");
  const accessToken = authHeader?.split(" ")[1];
  console.log(roomName, roomId, callersByConnectionId, accessToken);
  const params = parseQueryParams(request.url);
  const connectionToken = params.get("token");

  if (accessToken) {
    return parseAccessTokenForCaller({
      accessToken,
      type: roomName,
      id: roomId,
      secret,
    });
  } else if (connectionToken) {
    const { payload } = await jwtVerify(
      connectionToken,
      new TextEncoder().encode(secret)
    );
    const connectionId = payload.jti;
    assert(connectionId, "expected connectionId when parsing connection token");
    return callersByConnectionId.get(connectionId);
  }
  return undefined;
};
