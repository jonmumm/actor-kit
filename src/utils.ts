import { jwtVerify, SignJWT } from "jose";
import type * as Party from "partykit/server";
import type { AnyStateMachine } from "xstate";
import { xstateMigrate } from "xstate-migrate";
import { PERSISTED_SNAPSHOT_KEY } from "./constants";
import { CallerStringSchema } from "./schemas";
import { Caller } from "./types";

/**
 * Loads a persisted snapshot from storage.
 * @param storage The storage interface to retrieve the snapshot from.
 * @returns The parsed snapshot or null if not found.
 */
export const loadPersistedSnapshot = async (storage: Party.Storage) => {
  const persistentSnapshot = await storage.get(PERSISTED_SNAPSHOT_KEY);
  return persistentSnapshot ? JSON.parse(persistentSnapshot as string) : null;
};

/**
 * Applies any necessary migrations to the persisted snapshot.
 * @param machine The current state machine definition.
 * @param parsedSnapshot The snapshot to migrate.
 * @returns The migrated snapshot.
 */
export const applyMigrations = (
  machine: AnyStateMachine,
  parsedSnapshot: any
) => {
  const migrations = xstateMigrate.generateMigrations(machine, parsedSnapshot);
  return xstateMigrate.applyMigrations(parsedSnapshot, migrations);
};

export const createConnectionToken = async (
  id: string,
  connectionId: string,
  callerType: string,
  secret: string
) => {
  let signJWT = new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(id)
    .setAudience(callerType)
    .setJti(connectionId)
    .setIssuedAt()
    .setExpirationTime("1d");

  const token = await signJWT.sign(new TextEncoder().encode(secret));
  return token;
};

export const parseConnectionToken = async (token: string, secret: string) => {
  const verified = await jwtVerify(token, new TextEncoder().encode(secret));
  assert(verified.payload.jti, "expected JTI on connectionToken");
  return verified;
};

export const json = <T>(data: T, status = 200) =>
  Response.json(data, { status });

export const ok = () => json({ ok: true });

export const error = (err: string | { message: string }, status = 500) => {
  console.error("Error response", err);
  return json(
    {
      ok: false,
      error: typeof err === "string" ? err : err.message ?? "Unknown error",
    },
    status
  );
};

export const notFound = () => error("Not found", 404);

/**
 * Parses query parameters from a URL string.
 * @param url The URL to parse.
 * @returns A URLSearchParams object containing the parsed query parameters.
 */
export const parseQueryParams = (url: string) => {
  const index = url.indexOf("?");
  const search = index !== -1 ? url.substring(index + 1) : "";
  return new URLSearchParams(search);
};

export function assert<T>(
  expression: T,
  errorMessage: string
): asserts expression {
  if (!expression) {
    const error = new Error(errorMessage);
    const stack = error.stack?.split("\n");

    // Find the line in the stack trace that corresponds to where the assert was called.
    // This is typically the third line in the stack, but this may vary depending on the JS environment.
    const assertLine =
      stack && stack.length >= 3 ? stack[2] : "unknown location";

    throw new Error(`${errorMessage} (Assert failed at ${assertLine?.trim()})`);
  }
}

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
