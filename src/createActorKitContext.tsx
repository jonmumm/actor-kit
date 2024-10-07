"use client";

import React, {
  createContext,
  ReactNode,
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

function defaultCompare<T>(a: T, b: T) {
  return a === b;
}


function useSyncExternalStoreWithSelector<Snapshot, Selection>(
  subscribe: (onStoreChange: () => void) => () => void,
  getSnapshot: () => Snapshot,
  getServerSnapshot: undefined | null | (() => Snapshot),
  selector: (snapshot: Snapshot) => Selection,
  isEqual?: (a: Selection, b: Selection) => boolean
): Selection {
  const instRef = useRef<{
    hasValue: boolean;
    value: Selection | null;
  }>({
    hasValue: false,
    value: null,
  });

  const [getSelection, getServerSelection, subscribeWithSelector] = useMemo(() => {
    let hasMemo = false;
    let memoizedSnapshot: Snapshot;
    let memoizedSelection: Selection;

    const memoizedSelector = (nextSnapshot: Snapshot) => {
      if (!hasMemo) {
        hasMemo = true;
        memoizedSnapshot = nextSnapshot;
        const nextSelection = selector(nextSnapshot);
        if (isEqual !== undefined && instRef.current.hasValue) {
          const currentSelection = instRef.current.value as Selection;
          if (isEqual(currentSelection, nextSelection)) {
            memoizedSelection = currentSelection;
            return currentSelection;
          }
        }
        memoizedSelection = nextSelection;
        return nextSelection;
      }

      if (Object.is(memoizedSnapshot, nextSnapshot)) {
        return memoizedSelection;
      }

      const nextSelection = selector(nextSnapshot);

      if (isEqual !== undefined && isEqual(memoizedSelection, nextSelection)) {
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

    const subscribeWithSelector = (onStoreChange: () => void) => {
      return subscribe(() => {
        const nextSelection = getSnapshotWithSelector();
        if (!isEqual || !isEqual(memoizedSelection, nextSelection)) {
          onStoreChange();
        }
      });
    };

    return [getSnapshotWithSelector, getServerSnapshotWithSelector, subscribeWithSelector];
  }, [getSnapshot, getServerSnapshot, selector, isEqual]);

  const value = useSyncExternalStore(
    subscribeWithSelector,
    getSelection,
    getServerSelection
  );

  // Update the instRef
  instRef.current.hasValue = true;
  instRef.current.value = value;

  return value;
}