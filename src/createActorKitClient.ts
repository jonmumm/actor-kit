import PartySocket from "partysocket";
import { applyPatch, Operation } from "fast-json-patch";

export type ActorKitClientOptions<TClientEvent, TSnapshot> = {
  host: string;
  actorType: string;
  actorId: string;
  connectionId: string;
  connectionToken: string;
  initialState: TSnapshot;
  onStateChange?: (newState: TSnapshot) => void;
  onError?: (error: Error) => void;
};

export type ActorKitClient<TClientEvent, TSnapshot> = {
  connect: () => Promise<void>;
  disconnect: () => void;
  send: (event: TClientEvent) => void;
  getState: () => TSnapshot;
  subscribe: (listener: (state: TSnapshot) => void) => () => void;
};

type Listener<T> = (state: T) => void;

export function createActorKitClient<TClientEvent, TSnapshot>(
  options: ActorKitClientOptions<TClientEvent, TSnapshot>
): ActorKitClient<TClientEvent, TSnapshot> {
  let currentState = options.initialState;
  let socket: PartySocket | null = null;
  const listeners: Set<Listener<TSnapshot>> = new Set();

  const notifyListeners = () => {
    listeners.forEach(listener => listener(currentState));
  };

  const connect = async () => {
    socket = new PartySocket({
      host: options.host,
      party: options.actorType,
      room: options.actorId,
      protocol: getWebsocketServerProtocol(options.host),
      id: options.connectionId,
      query: { token: options.connectionToken },
    });

    socket.addEventListener("message", (event: MessageEvent) => {
      try {
        const { operations } = JSON.parse(event.data);
        currentState = applyPatch(currentState, operations).newDocument;
        options.onStateChange?.(currentState);
        notifyListeners();
      } catch (error) {
        options.onError?.(error as Error);
      }
    });

    socket.addEventListener("error", (error) => {
      options.onError?.(new Error("WebSocket error: " + error.toString()));
    });

    socket.addEventListener("close", () => {
      options.onError?.(new Error("WebSocket connection closed"));
    });

    return new Promise<void>((resolve) => {
      socket!.addEventListener("open", () => resolve());
    });
  };

  const disconnect = () => {
    socket?.close();
    socket = null;
  };

  const send = (event: TClientEvent) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(event));
    } else {
      options.onError?.(new Error("Cannot send event: WebSocket is not connected"));
    }
  };

  const getState = () => currentState;

  const subscribe = (listener: Listener<TSnapshot>) => {
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