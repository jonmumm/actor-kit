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

  /**
   * Notifies all registered listeners with the current state.
   */
  const notifyListeners = () => {
    listeners.forEach((listener) => listener(currentState));
  };

  /**
   * Establishes a WebSocket connection to the Actor Kit server.
   * @returns {Promise<void>} A promise that resolves when the connection is established.
   */
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

  /**
   * Closes the WebSocket connection to the Actor Kit server.
   */
  const disconnect = () => {
    socket?.close();
    socket = null;
  };

  /**
   * Sends an event to the Actor Kit server.
   * @param {ClientEventFrom<TMachine>} event - The event to send.
   */
  const send = (event: ClientEventFrom<TMachine>) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(event));
    } else {
      props.onError?.(
        new Error("Cannot send event: WebSocket is not connected")
      );
    }
  };

  /**
   * Retrieves the current state of the actor.
   * @returns {CallerSnapshotFrom<TMachine>} The current state.
   */
  const getState = () => currentState;

  /**
   * Subscribes a listener to state changes.
   * @param {Listener<CallerSnapshotFrom<TMachine>>} listener - The listener function to be called on state changes.
   * @returns {() => void} A function to unsubscribe the listener.
   */
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

/**
 * Checks if the given API host is a local address.
 * @param {string} apiHost - The API host to check.
 * @returns {boolean} True if the host is local, false otherwise.
 */
function isLocal(apiHost: string): boolean {
  return (
    apiHost.startsWith("localhost") ||
    apiHost.startsWith("0.0.0.0") ||
    apiHost.startsWith("127.0.0.1")
  );
}

/**
 * Determines the appropriate WebSocket protocol based on the API host.
 * @param {string} apiHost - The API host.
 * @returns {"ws" | "wss"} The WebSocket protocol to use.
 */
function getWebsocketServerProtocol(apiHost: string): "ws" | "wss" {
  return isLocal(apiHost) ? "ws" : "wss";
}
