import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { createActorKitClient, ActorKitClient, ActorKitClientOptions } from './createActorKitClient';

export function createActorKitContext<TClientEvent, TSnapshot>() {
  const ActorKitContext = createContext<ActorKitClient<TClientEvent, TSnapshot> | null>(null);

  const Provider: React.FC<{
    children: ReactNode;
    options: ActorKitClientOptions<TClientEvent, TSnapshot>;
  }> = ({ children, options }) => {
    const [client, setClient] = useState<ActorKitClient<TClientEvent, TSnapshot> | null>(null);

    useEffect(() => {
      const newClient = createActorKitClient(options);
      newClient.connect().then(() => {
        setClient(newClient);
      });

      return () => {
        newClient.disconnect();
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

  function useClient(): ActorKitClient<TClientEvent, TSnapshot> {
    const client = useContext(ActorKitContext);
    if (!client) {
      throw new Error('useClient must be used within an ActorKitContext.Provider');
    }
    return client;
  }

  function useSelector<T>(selector: (state: TSnapshot) => T): T {
    const client = useClient();
    const [selectedState, setSelectedState] = useState<T>(() => selector(client.getState()));

    useEffect(() => {
      return client.subscribe((state: TSnapshot) => {
        const newSelectedState = selector(state);
        if (!Object.is(newSelectedState, selectedState)) {
          setSelectedState(newSelectedState);
        }
      });
    }, [client, selector, selectedState]);

    return selectedState;
  }

  function useSend(): (event: TClientEvent) => void {
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