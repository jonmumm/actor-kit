import { z } from "zod";
import { createAccessToken } from "./createAccessToken";
import { ActorKitStateMachine, CallerSnapshotFrom } from "./types";

const ResponseSchema = z.object({
  snapshot: z.record(z.any()),
  connectionId: z.string(),
  connectionToken: z.string(),
});

export function createActorFetch<TMachine extends ActorKitStateMachine>(
  actorType: string
) {
  return async function fetchActor(
    props: {
      actorId: string;
      callerId: string;
      host?: string;
      signingKey?: string;
      input?: Record<string, unknown>;
      waitFor?: string; // Add this new parameter
    },
    options?: RequestInit
  ): Promise<{
    snapshot: CallerSnapshotFrom<TMachine>;
    connectionId: string;
    connectionToken: string;
  }> {
    const host = props?.host ?? process.env.ACTOR_KIT_HOST;
    const signingKey = props?.signingKey ?? process.env.ACTOR_KIT_SECRET;
    const input = props.input ?? {};

    if (!host) throw new Error("Actor Kit host is not defined");
    if (!signingKey) throw new Error("Actor Kit signing key is not defined");

    const accessToken = await createAccessToken({
      signingKey,
      actorId: props.actorId,
      actorType,
      callerId: props.callerId,
      callerType: "client",
    });

    const route = getActorRoute(actorType, props.actorId);
    const protocol = getHttpProtocol(host);
    const url = new URL(`${protocol}://${host}${route}`);
    
    // Add input and waitFor to URL parameters
    url.searchParams.append('input', JSON.stringify(input));
    if (props.waitFor) {
      url.searchParams.append('waitFor', props.waitFor);
    }

    console.log("url", url.toString());
    console.log("accessToken", accessToken);

    const response = await fetch(url.toString(), {
      ...options,
      headers: {
        ...options?.headers,
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch actor: ${response.statusText}`);
    }

    const data = await response.json();
    const { connectionId, snapshot, connectionToken } = ResponseSchema.parse(data);

    return {
      snapshot: snapshot as CallerSnapshotFrom<TMachine>,
      connectionId,
      connectionToken,
    };
  };
}

function getActorRoute(actorType: string, actorId: string) {
  return `/parties/${actorType}/${actorId}`;
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
