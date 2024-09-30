"use client";

import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useSyncExternalStoreWithSelector } from "use-sync-external-store/shim/with-selector";
import type {
  ActorKitClient,
  ActorKitClientProps,
} from "./createActorKitClient";
import { createActorKitClient } from "./createActorKitClient";
import type {
  ActorKitStateMachine,
  CallerSnapshotFrom,
  ClientEventFrom,
} from "./types";

export function createActorKitContext<TMachine extends ActorKitStateMachine>(
  actorType: string
) {
  const ActorKitContext = createContext<ActorKitClient<TMachine> | null>(null);

  const Provider: React.FC<{
    children: ReactNode;
    options: Omit<ActorKitClientProps<TMachine>, 'actorType'>;
  }> = ({ children, options }) => {
    const [client, setClient] = useState<ActorKitClient<TMachine> | null>(null);
    const clientRef = useRef<ActorKitClient<TMachine> | null>(null);

    useEffect(() => {
      if (!clientRef.current) {
        const newClient = createActorKitClient<TMachine>({
          ...options,
          actorType,
        });
        clientRef.current = newClient;
        newClient.connect().then(() => {
          setClient(newClient);
        });
      }

      return () => {
        if (clientRef.current) {
          clientRef.current.disconnect();
          clientRef.current = null;
        }
      };
    }, [options]);

    if (!client) {
      return null; // or a loading indicator
    }

    return (
      <ActorKitContext.Provider value={client}>
        {children}
      </ActorKitContext.Provider>
    );
  };

  function useClient(): ActorKitClient<TMachine> {
    const client = useContext(ActorKitContext);
    if (!client) {
      throw new Error(
        "useClient must be used within an ActorKitContext.Provider"
      );
    }
    return client;
  }

  const useSelector = <T,>(
    selector: (snapshot: CallerSnapshotFrom<TMachine>) => T
  ) => {
    const client = useClient();

    return useSyncExternalStoreWithSelector(
      client.subscribe,
      client.getState,
      client.getState,
      selector,
      defaultCompare
    );
  };

  function useSend(): (event: ClientEventFrom<TMachine>) => void {
    const client = useClient();
    return client.send;
  }

  return {
    Provider,
    useClient,
    useSelector,
    useSend,
  };
}

function defaultCompare<T>(a: T, b: T) {
  return a === b;
}
