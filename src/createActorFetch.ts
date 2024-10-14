import { z } from "zod";
import { BaseActorKitStateMachine, CallerSnapshotFrom } from "./types";

const ResponseSchema = z.object({
  snapshot: z.record(z.any()),
  checksum: z.string(),
});

export function createActorFetch<TMachine extends BaseActorKitStateMachine>({
  actorType,
  host,
}: {
  actorType: string;
  host: string;
}) {
  return async function fetchActor(
    props: {
      actorId: string;
      accessToken: string;
      input?: Record<string, unknown>;
      waitFor?: string; // Add this new parameter
    },
    options?: RequestInit
  ): Promise<{
    snapshot: CallerSnapshotFrom<TMachine>;
    checksum: string;
  }> {
    const input = props.input ?? {};

    if (!host) throw new Error("Actor Kit host is not defined");

    const route = getActorRoute(actorType, props.actorId);
    const protocol = getHttpProtocol(host);
    const url = new URL(`${protocol}://${host}${route}`);

    // Add input and waitFor to URL parameters
    url.searchParams.append("input", JSON.stringify(input));
    if (props.waitFor) {
      url.searchParams.append("waitFor", props.waitFor);
    }

    const response = await fetch(url.toString(), {
      ...options,
      headers: {
        ...options?.headers,
        Authorization: `Bearer ${props.accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch actor: ${response.statusText}`);
    }

    const data = await response.json();
    const { checksum, snapshot } = ResponseSchema.parse(data);

    return {
      snapshot: snapshot as CallerSnapshotFrom<TMachine>,
      checksum,
    };
  };
}

function getActorRoute(actorType: string, actorId: string) {
  return `/api/${actorType}/${actorId}`;
}

function getHttpProtocol(host: string): "http" | "https" {
  return isLocal(host) ? "http" : "https";
}

function isLocal(host: string): boolean {
  return (
    host.startsWith("localhost") ||
    host.startsWith("127.0.0.1") ||
    host.startsWith("0.0.0.0")
  );
}
