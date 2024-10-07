"use client";

import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
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

function useSyncExternalStoreWithSelector<Snapshot, Selection>(
  subscribe: (onStoreChange: () => void) => () => void,
  getSnapshot: () => Snapshot,
  getServerSnapshot: undefined | null | (() => Snapshot),
  selector: (snapshot: Snapshot) => Selection,
  isEqual?: (a: Selection, b: Selection) => boolean
): Selection {
  const [getSelection, getServerSelection] = useMemo(() => {
    let hasMemo = false;
    let memoizedSnapshot: Snapshot;
    let memoizedSelection: Selection;

    const memoizedSelector = (nextSnapshot: Snapshot) => {
      if (!hasMemo) {
        hasMemo = true;
        memoizedSnapshot = nextSnapshot;
        memoizedSelection = selector(nextSnapshot);
        return memoizedSelection;
      }

      if (Object.is(memoizedSnapshot, nextSnapshot)) {
        return memoizedSelection;
      }

      const nextSelection = selector(nextSnapshot);

      if (isEqual && isEqual(memoizedSelection, nextSelection)) {
        memoizedSnapshot = nextSnapshot;
        return memoizedSelection;
      }

      memoizedSnapshot = nextSnapshot;
      memoizedSelection = nextSelection;
      return nextSelection;
    };

    const getSnapshotWithSelector = () => memoizedSelector(getSnapshot());
    const getServerSnapshotWithSelector = getServerSnapshot
      ? () => memoizedSelector(getServerSnapshot())
      : undefined;

    return [getSnapshotWithSelector, getServerSnapshotWithSelector];
  }, [getSnapshot, getServerSnapshot, selector, isEqual]);

  const subscribeWithSelector = useCallback(
    (onStoreChange: () => void) => {
      let previousSelection = getSelection();
      return subscribe(() => {
        const nextSelection = getSelection();
        if (!isEqual || !isEqual(previousSelection, nextSelection)) {
          previousSelection = nextSelection;
          onStoreChange();
        }
      });
    },
    [subscribe, getSelection, isEqual]
  );

  return useSyncExternalStore(
    subscribeWithSelector,
    getSelection,
    getServerSelection
  );
}

function defaultCompare<T>(a: T, b: T) {
  return a === b;
}
