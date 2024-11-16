import { applyPatch } from "fast-json-patch";
import { produce } from "immer";

import {
  ActorKitClient,
  ActorKitEmittedEvent,
  AnyActorKitStateMachine,
  CallerSnapshotFrom,
  ClientEventFrom,
} from "./types";

export type ActorKitClientProps<TMachine extends AnyActorKitStateMachine> = {
  host: string;
  actorType: string;
  actorId: string;
  checksum: string;
  accessToken: string;
  initialSnapshot: CallerSnapshotFrom<TMachine>;
  onStateChange?: (newState: CallerSnapshotFrom<TMachine>) => void;
  onError?: (error: Error) => void;
};

type Listener<T> = (state: T) => void;

/**
 * Creates an Actor Kit client for managing state and communication with the server.
 *
 * @template TMachine - The type of the state machine.
 * @param {ActorKitClientProps<TMachine>} props - Configuration options for the client.
 * @returns {ActorKitClient<TMachine>} An object with methods to interact with the actor.
 */
export function createActorKitClient<TMachine extends AnyActorKitStateMachine>(
  props: ActorKitClientProps<TMachine>
): ActorKitClient<TMachine> {
  let currentSnapshot = props.initialSnapshot;
  let socket: WebSocket | null = null;
  const listeners: Set<Listener<CallerSnapshotFrom<TMachine>>> = new Set();
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 5;

  /**
   * Notifies all registered listeners with the current state.
   */
  const notifyListeners = () => {
    listeners.forEach((listener) => listener(currentSnapshot));
  };

  /**
   * Establishes a WebSocket connection to the Actor Kit server.
   * @returns {Promise<void>} A promise that resolves when the connection is established.
   */
  const connect = async () => {
    const url = getWebSocketUrl(props);

    socket = new WebSocket(url);

    socket.addEventListener("open", () => {
      reconnectAttempts = 0;
    });

    socket.addEventListener("message", (event: MessageEvent) => {
      try {
        const data = JSON.parse(
          typeof event.data === "string"
            ? event.data
            : new TextDecoder().decode(event.data)
        ) as ActorKitEmittedEvent;

        currentSnapshot = produce(currentSnapshot, (draft) => {
          applyPatch(draft, data.operations);
        });

        props.onStateChange?.(currentSnapshot);
        notifyListeners();
      } catch (error) {
        console.error(`[ActorKitClient] Error processing message:`, error);
        props.onError?.(error as Error);
      }
    });

    socket.addEventListener("error", (error: any) => {
      console.error(`[ActorKitClient] WebSocket error:`, error);
      console.error(`[ActorKitClient] Error details:`, {
        message: error.message,
        type: error.type,
        target: error.target,
        eventPhase: error.eventPhase,
      });
      props.onError?.(new Error(`WebSocket error: ${JSON.stringify(error)}`));
    });

    // todo, how do we reconnect when a user returns to the tab
    // later after it's disconnected

    socket.addEventListener("close", (event) => {
      // Implement reconnection logic
      if (reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
        setTimeout(connect, delay);
      } else {
        console.error(`[ActorKitClient] Max reconnection attempts reached`);
      }
    });

    return new Promise<void>((resolve) => {
      socket!.addEventListener("open", () => resolve());
    });
  };

  /**
   * Closes the WebSocket connection to the Actor Kit server.
   */
  const disconnect = () => {
    if (socket) {
      socket.close();
      socket = null;
    }
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
  const getState = () => currentSnapshot;

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

  /**
   * Waits for a state condition to be met.
   * @param {(state: CallerSnapshotFrom<TMachine>) => boolean} predicateFn - Function that returns true when condition is met
   * @param {number} [timeoutMs=5000] - Maximum time to wait in milliseconds
   * @returns {Promise<void>} Resolves when condition is met, rejects on timeout
   */
  const waitFor = async (
    predicateFn: (state: CallerSnapshotFrom<TMachine>) => boolean,
    timeoutMs: number = 5000
  ): Promise<void> => {
    // Check if condition is already met
    if (predicateFn(currentSnapshot)) {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      let timeoutId: number | null = null;

      // Set up timeout to reject if condition isn't met in time
      if (timeoutMs > 0) {
        timeoutId = setTimeout(() => {
          unsubscribe();
          reject(
            new Error(`Timeout waiting for condition after ${timeoutMs}ms`)
          );
        }, timeoutMs);
      }

      // Subscribe to state changes
      const unsubscribe = subscribe((state) => {
        if (predicateFn(state)) {
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
          unsubscribe();
          resolve();
        }
      });
    });
  };

  return {
    connect,
    disconnect,
    send,
    getState,
    subscribe,
    waitFor,
  };
}

function getWebSocketUrl(props: ActorKitClientProps<any>): string {
  const { host, actorId, actorType, accessToken, checksum } = props;

  // Determine protocol (ws or wss)
  const protocol =
    /^(localhost|127\.0\.0\.1|192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(
      host
    )
      ? "ws"
      : "wss";

  // Construct base URL
  const baseUrl = `${protocol}://${host}/api/${actorType}/${actorId}`;

  // Add query parameters
  const params = new URLSearchParams({ accessToken });
  if (checksum) params.append("checksum", checksum);

  const finalUrl = `${baseUrl}?${params.toString()}`;

  return finalUrl;
}
