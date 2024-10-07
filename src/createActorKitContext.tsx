"use client";

import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
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

  const Provider: React.FC<
    {
      children: ReactNode;
    } & Omit<ActorKitClientProps<TMachine>, "actorType">
  > = ({ children, ...props }) => {
    const connectedRef = useRef<boolean>(false);
    const clientConfig = useMemo(
      () => ({
        ...props,
        actorType,
      }),
      [
        props.host,
        props.actorId,
        props.accessToken,
        props.checksum,
        props.initialSnapshot,
        actorType,
      ]
    );

    const [client] = useState(() => {
      return createActorKitClient<TMachine>(clientConfig);
    });

    useEffect(() => {
      if (!connectedRef.current) {
        client.connect().then(() => {});
        connectedRef.current = true;
      }
    }, [client, connectedRef]); // Use memoized config as dependency

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
