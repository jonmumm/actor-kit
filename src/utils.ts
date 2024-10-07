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
  actorId: string,
  connectionId: string,
  callerType: string,
  secret: string
) => {
  let signJWT = new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(actorId)
    .setAudience(callerType)
    .setJti(connectionId)
    .setIssuedAt()
    .setExpirationTime("1d");

  const token = await signJWT.sign(new TextEncoder().encode(secret));
  return token;
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

export async function getCallerFromRequest(
  request: Request,
  actorType: string,
  actorId: string,
  secret: string
): Promise<Caller> {
  let accessToken: string;
  console.log(actorType, actorId, secret);
  if (request.headers.get("Upgrade") !== "websocket") {
    const authHeader = request.headers.get("Authorization");
    const stringPart = authHeader?.split(" ")[1];
    assert(stringPart, "Expected authorization header to be set");
    accessToken = stringPart;
  } else {
    const searchParams = new URLSearchParams(request.url.split("?")[1]);
    const paramString = searchParams.get("accessToken");
    assert(paramString, "expected accessToken when connecting to socket");
    accessToken = paramString;
  }
  console.log({ accessToken, actorType, actorId, secret });

  return parseAccessTokenForCaller({
    accessToken,
    type: actorType,
    id: actorId,
    secret,
  });
}

export async function parseAccessTokenForCaller({
  accessToken,
  type,
  id,
  secret,
}: {
  accessToken: string;
  type: string;
  id: string;
  secret: string;
}): Promise<Caller> {
  const verified = await jwtVerify(
    accessToken,
    new TextEncoder().encode(secret)
  );
  if (!verified.payload.jti) {
    throw new Error("Expected JTI on accessToken");
  }
  if (verified.payload.jti !== id) {
    throw new Error(`Expected JTI on accessToken to match actor id: ${id}`);
  }
  if (!verified.payload.aud) {
    throw new Error(
      `Expected accessToken audience to match actor type: ${type}`
    );
  }
  if (!verified.payload.sub) {
    throw new Error("Expected accessToken to have subject");
  }
  return CallerStringSchema.parse(verified.payload.sub);
}
