import type {
  DurableObjectJurisdiction,
  DurableObjectLocationHint,
  DurableObjectNamespace,
  Request as WorkersRequest,
  Response as WorkersResponse,
} from "@cloudflare/workers-types";

// Cache for server namespaces
const serverMapCache = new WeakMap<
  Record<string, unknown>,
  Record<string, DurableObjectNamespace>
>();

function camelCaseToKebabCase(str: string): string {
  let kebabified = str.replace(
    /[A-Z]/g,
    (letter) => `-${letter.toLowerCase()}`
  );
  kebabified = kebabified.startsWith("-") ? kebabified.slice(1) : kebabified;
  return kebabified.replace(/-$/, "");
}

export async function routeActorKitRequest<Env = unknown>(
  req: WorkersRequest,
  env: Record<string, unknown>,
  options?: {
    prefix?: string;
    jurisdiction?: DurableObjectJurisdiction;
    locationHint?: DurableObjectLocationHint;
  }
): Promise<WorkersResponse | null> {
  if (!serverMapCache.has(env)) {
    serverMapCache.set(
      env,
      Object.entries(env).reduce((acc, [k, v]) => {
        if (
          v &&
          typeof v === "object" &&
          "idFromName" in v &&
          typeof v.idFromName === "function"
        ) {
          return { ...acc, [camelCaseToKebabCase(k)]: v };
        }
        return acc;
      }, {})
    );
  }
  const map = serverMapCache.get(env) as Record<string, DurableObjectNamespace>;

  const prefix = options?.prefix || "api";

  const url = new URL(req.url);
  const parts = url.pathname.split("/");

  if (parts[1] !== prefix || parts.length < 4) {
    return null;
  }

  const actorType = parts[2];
  const actorId = parts[3];

  if (!map[actorType]) {
    console.error(`The url ${req.url} does not match any actor namespace. 
Did you forget to add a durable object binding for ${actorType} in your wrangler.toml?`);
    return new Response("Actor type not found", {
      status: 404,
    }) as unknown as WorkersResponse;
  }

  let doNamespace = map[actorType];
  if (options?.jurisdiction) {
    doNamespace = doNamespace.jurisdiction(options.jurisdiction);
  }

  const id = doNamespace.idFromName(actorId);
  const stub = doNamespace.get(id, options);

  // Create a new request with additional headers
  const newHeaders = new Headers();
  req.headers.forEach((value, key) => {
    newHeaders.set(key, value);
  });
  newHeaders.set("x-actorkit-id", actorId);
  newHeaders.set("x-actorkit-type", actorType);
  if (options?.jurisdiction) {
    newHeaders.set("x-actorkit-jurisdiction", options.jurisdiction);
  }

  const newReq = new Request(req.url, {
    method: req.method,
    headers: newHeaders as any,
    body: req.body as any,
    // @ts-expect-error TODO: typescript hell
    cf: req.cf,
  }) as unknown as WorkersRequest;

  return stub.fetch(newReq);
}
