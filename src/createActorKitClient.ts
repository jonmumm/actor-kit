import { applyPatch } from "fast-json-patch";
import { produce } from "immer";
import PartySocket from "partysocket";
import {
  ActorKitStateMachine,
  CallerSnapshotFrom,
  ClientEventFrom,
} from "./types";

export type ActorKitClientProps<TMachine extends ActorKitStateMachine> = {
  host: string;
  actorType: string;
  actorId: string;
  connectionId: string;
  connectionToken: string;
  initialState: CallerSnapshotFrom<TMachine>;
  onStateChange?: (newState: CallerSnapshotFrom<TMachine>) => void;
  onError?: (error: Error) => void;
};

export type ActorKitClient<TMachine extends ActorKitStateMachine> = {
  connect: () => Promise<void>;
  disconnect: () => void;
  send: (event: ClientEventFrom<TMachine>) => void;
  getState: () => CallerSnapshotFrom<TMachine>;
  subscribe: (
    listener: (state: CallerSnapshotFrom<TMachine>) => void
  ) => () => void;
};

type Listener<T> = (state: T) => void;

/**
 * Creates an Actor Kit client for managing state and communication with the server.
 *
 * @template TMachine - The type of the state machine.
 * @param {ActorKitClientProps<TMachine>} props - Configuration options for the client.
 * @returns {ActorKitClient<TMachine>} An object with methods to interact with the actor.
 */
export function createActorKitClient<TMachine extends ActorKitStateMachine>(
  props: ActorKitClientProps<TMachine>
): ActorKitClient<TMachine> {
  let currentState = props.initialState;
  let socket: PartySocket | null = null;
  const listeners: Set<Listener<CallerSnapshotFrom<TMachine>>> = new Set();

  const notifyListeners = () => {
    listeners.forEach((listener) => listener(currentState));
  };

  const connect = async () => {
    socket = new PartySocket({
      host: props.host,
      party: props.actorType,
      room: props.actorId,
      protocol: getWebsocketServerProtocol(props.host),
      id: props.connectionId,
      query: { token: props.connectionToken },
    });

    socket.addEventListener("message", (event: MessageEvent) => {
      try {
        const { operations } = JSON.parse(event.data);
        currentState = produce(currentState, (draft) => {
          applyPatch(draft, operations);
        });
        props.onStateChange?.(currentState);
        notifyListeners();
      } catch (error) {
        props.onError?.(error as Error);
      }
    });

    socket.addEventListener("error", (error) => {
      props.onError?.(new Error("WebSocket error: " + error.toString()));
    });

    socket.addEventListener("close", () => {
      props.onError?.(new Error("WebSocket connection closed"));
    });

    return new Promise<void>((resolve) => {
      socket!.addEventListener("open", () => resolve());
    });
  };

  const disconnect = () => {
    socket?.close();
    socket = null;
  };

  const send = (event: ClientEventFrom<TMachine>) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(event));
    } else {
      props.onError?.(
        new Error("Cannot send event: WebSocket is not connected")
      );
    }
  };

  const getState = () => currentState;

  const subscribe = (listener: Listener<CallerSnapshotFrom<TMachine>>) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  return {
    connect,
    disconnect,
    send,
    getState,
    subscribe,
  };
}

function isLocal(apiHost: string): boolean {
  return (
    apiHost.startsWith("localhost") ||
    apiHost.startsWith("0.0.0.0") ||
    apiHost.startsWith("127.0.0.1")
  );
}

function getWebsocketServerProtocol(apiHost: string): "ws" | "wss" {
  return isLocal(apiHost) ? "ws" : "wss";
}
