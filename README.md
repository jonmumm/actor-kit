# Actor Kit

Actor Kit is a library for creating and managing actor-based state machines in server environments. It provides a framework for handling different types of events from various sources and manages the lifecycle of actors.

## Installation

To install Actor Kit, use your preferred package manager:

```bash
npm install actor-kit
# or
yarn add actor-kit
# or
pnpm add actor-kit
```

## Usage

Here's an example of how to use Actor Kit to create a todo list application, using the `WithActorKitEvent` helper and inferring event types from Zod schemas:

```typescript
import type { WithActorKitEvent } from "actor-kit";
import { createMachineServer } from 'actor-kit/server';
import { z } from 'zod';
import { setup } from 'xstate';

// Define your event schemas
const TodoClientEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ADD_TODO'), text: z.string() }),
  z.object({ type: z.literal('TOGGLE_TODO'), id: z.string() }),
  z.object({ type: z.literal('REMOVE_TODO'), id: z.string() }),
]);

const TodoServiceEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('SYNC_TODOS'), todos: z.array(z.object({ id: z.string(), text: z.string(), completed: z.boolean() })) }),
]);

const TodoOutputEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('TODO_ADDED'), todo: z.object({ id: z.string(), text: z.string(), completed: z.boolean() }) }),
  z.object({ type: z.literal('TODO_TOGGLED'), id: z.string(), completed: z.boolean() }),
  z.object({ type: z.literal('TODO_REMOVED'), id: z.string() }),
]);

// Infer event types using WithActorKitEvent
type TodoClientEvent = WithActorKitEvent<z.infer<typeof TodoClientEventSchema>, "client">;
type TodoServiceEvent = WithActorKitEvent<z.infer<typeof TodoServiceEventSchema>, "service">;

// Combine event types
type TodoEvent = TodoClientEvent | TodoServiceEvent;

// Define your state machine
const createTodoListMachine = ({ id, send, caller }: CreateMachineProps<z.infer<typeof TodoOutputEventSchema>>) =>
  setup({
    types: {
      context: {} as {
        public: {
          todos: Array<{ id: string; text: string; completed: boolean }>;
          lastSync: Date | null;
        };
        history: Array<{ type: string; sentAt: number; [key: string]: any }>;
      },
      events: {} as TodoEvent,
    },
    actions: {
      addTodo: ({ context, event }) => {
        if (event.type === 'ADD_TODO') {
          const newTodo = { id: Date.now().toString(), text: event.text, completed: false };
          context.public.todos.push(newTodo);
          context.history.push({ type: 'TODO_ADDED', todo: newTodo, sentAt: Date.now() });
        }
      },
      toggleTodo: ({ context, event }) => {
        if (event.type === 'TOGGLE_TODO') {
          const todo = context.public.todos.find(t => t.id === event.id);
          if (todo) {
            todo.completed = !todo.completed;
            context.history.push({ type: 'TODO_TOGGLED', id: todo.id, completed: todo.completed, sentAt: Date.now() });
          }
        }
      },
      removeTodo: ({ context, event }) => {
        if (event.type === 'REMOVE_TODO') {
          context.public.todos = context.public.todos.filter(t => t.id !== event.id);
          context.history.push({ type: 'TODO_REMOVED', id: event.id, sentAt: Date.now() });
        }
      },
    },
  }).createMachine({
    id: `todo-list-${id}`,
    context: {
      public: {
        todos: [],
        lastSync: null,
      },
      history: [],
    },
    type: 'parallel',
    states: {
      Initialization: {
        initial: 'Ready',
        states: {
          Ready: {},
        },
      },
      TodoList: {
        on: {
          ADD_TODO: { actions: ['addTodo'] },
          TOGGLE_TODO: { actions: ['toggleTodo'] },
          REMOVE_TODO: { actions: ['removeTodo'] },
        },
      },
    },
  });

// Create your actor server
const TodoListServer = createMachineServer(
  createTodoListMachine,
  {
    client: TodoClientEventSchema,
    service: TodoServiceEventSchema,
    output: TodoOutputEventSchema,
  },
  { persisted: true }
);

export default TodoListServer;
```

## Using `createAccessToken` in a React App

To use `createAccessToken` in a React app, you'll typically create the access token on the server-side and then pass it to your React application. Here's an example of how you might use it in a Remix app for our todo list application:

```typescript
import { assert } from "@/lib/utils";
import type { TodoPersistedSnapshot } from "@/server/todo.machine";
import { useLoaderData, useLocation } from "@remix-run/react";
import { EnvironmentSchema, createAccessToken } from "actor-kit";
import type { LoaderFunctionArgs } from "partymix";
import { z } from "zod";
import { AppContext } from "~/components/app-context";

const ResponseSchema = z.object({
  connectionId: z.string(),
  token: z.string(),
  snapshot: z.custom<TodoPersistedSnapshot>(),
});

export const loader = async function ({ context }: LoaderFunctionArgs) {
  const todoServer = context.lobby.parties["todo"];
  assert(todoServer, "expected todoServer");
  const userId = crypto.randomUUID();

  const { API_AUTH_SECRET, API_HOST } = EnvironmentSchema.parse(
    context.lobby.env
  );

  const accessToken = await createAccessToken({
    signingKey: API_AUTH_SECRET,
    actorId: userId,
    callerId: userId, // This should be dynamically set based on the actual user
    callerType: "client",
    type: "todo",
  });

  const input = {};
  const response = await todoServer
    .get(`${userId}?input=${encodeURIComponent(JSON.stringify(input))}`)
    .fetch({
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  const data = await response.json();
  const parsedData = ResponseSchema.parse(data);
  return { ...parsedData, host: API_HOST };
};

export default function TodoApp() {
  const data = useLoaderData<typeof loader>();
  const location = useLocation();

  return (
    <AppContext.Provider
      input={{
        userId: data.connectionId,
        connectionId: data.connectionId,
        connectionToken: data.token,
        host: data.host,
        url: location.pathname + location.search,
        initialSnapshot: data.snapshot as TodoPersistedSnapshot,
      }}
    >
      {/* Your todo app components go here */}
    </AppContext.Provider>
  );
}
```

In this example:

1. We use `createAccessToken` in the loader function to generate an access token for the client.
2. The access token is created with the necessary parameters, including the `signingKey`, `actorId`, `callerId`, `callerType`, and `type`.
3. We use this access token to make an authenticated request to the todo server.
4. The response, including the access token, is passed to the React component via `useLoaderData`.
5. In the React component, we use the `AppContext.Provider` to make the access token and other necessary data available to child components.

This setup allows your React components to interact with the Actor Kit server using the provided access token, ensuring secure and authenticated communication for your todo list application.

## API Reference

### `actor-kit`

The main package exports:

- Common types and schemas
- `createAccessToken`: Function for creating access tokens

### `actor-kit/server`

Exports:

- `createMachineServer`: The main function for creating an actor server.

#### Parameters

1. `createMachine`: A function that creates the state machine.
   - Receives `props` of type `CreateMachineProps`
2. `eventSchemas`: An object containing Zod schemas for different event types:
   - `client`: Schema for events from end-users or client applications
   - `service`: Schema for events from trusted services or internal microservices
   - `output`: Schema for output events broadcast to connected clients
3. `options`: (Optional) Additional options for the server:
   - `persisted`: Boolean indicating whether the actor's state should be persisted (default: false)

#### Returns

An `ActorServer` class that implements the `Party.Server` interface.

### `WithActorKitEvent<TEvent, TCallerType>`

A type helper that wraps an event type with Actor Kit-specific properties.

#### Type Parameters

- `TEvent`: The base event type
- `TCallerType`: The type of caller ("client" or "service")

#### Added Properties

- `caller`: Information about the event caller
- `cf`: CloudFlare-specific properties (optional)

## Caller Types

Actor Kit supports different types of callers:

- `CLIENT`: Events from end-users or client applications
- `SYSTEM`: Internal events generated by the actor system (handled internally)
- `SERVICE`: Events from trusted external services or internal microservices

## PartyKit Integration

To use Actor Kit with PartyKit, create a `partykit.json` file in your project root:

```json
{
  "$schema": "https://www.partykit.io/schema.json",
  "name": "todo-list",
  "main": "build/index.js",
  "compatibilityDate": "2023-12-22",
  "parties": {
    "todo": "server/todo.server.ts"
  },
  "serve": "public"
}
```

Key points about this configuration:

- `name`: Set this to your project name (e.g., "todo-list").
- `main`: Points to the built JavaScript file (e.g., "build/index.js").
- `compatibilityDate`: Specifies the PartyKit compatibility date.
- `parties`: Defines the entry points for your party servers. In this example, "todo" is set to "server/todo.server.ts".
- `serve`: Specifies the directory to serve static files from (e.g., "public").

Adjust these fields as needed for your specific project structure and requirements.

# Actor Kit

[... previous content remains the same ...]

## Setting up App Context and PartySocket

After setting up your server and generating the access token, you'll need to set up the app context and establish a connection using PartySocket. Here's an example of how you might do this:

### App Context Setup

First, let's create an `AppContext` that will manage the state and connection for our todo list application:

```typescript
// app-context.tsx
import { atom } from "nanostores";
import type { ReactNode } from "react";
import { createContext, useContext, useLayoutEffect, useState } from "react";
import { useSyncExternalStoreWithSelector } from "use-sync-external-store/shim/with-selector";
import { createActor } from "xstate";
import type { AppActor, AppSnapshot } from "~/state/app-machine";
import { createAppMachine } from "~/state/app-machine";
import { event$ } from "~/state/event";

export const AppContext = (() => {
  const started$ = atom(false);
  const Provider = ({
    input,
    children,
  }: {
    input: {
      userId: string;
      connectionId: string;
      connectionToken: string;
      url: string;
      initialSnapshot: TodoPersistedSnapshot;
      host: string;
    };
    children: ReactNode;
  }) => {
    const [machine] = useState(createAppMachine());
    const [actor] = useState(createActor(machine, { input }));
    useLayoutEffect(() => {
      if (!started$.get()) {
        started$.set(true);
        actor.start();
        event$.subscribe((event) => {
          event && actor.send(event);
        });
      }
    }, [actor]);

    return (
      <InnerContext.Provider value={actor}>
        {children}
      </InnerContext.Provider>
    );
  };

  const useSelector = <T,>(selector: (snapshot: AppSnapshot) => T) => {
    const actor = useContext(InnerContext);
    const subscribe = (onStoreChange: () => void) => {
      const { unsubscribe } = actor.subscribe(onStoreChange);
      return unsubscribe;
    };
    const getSnapshot = () => actor.getSnapshot();
    const selectedSnapshot = useSyncExternalStoreWithSelector(
      subscribe,
      getSnapshot,
      getSnapshot,
      selector,
      (a, b) => a === b
    );
    return selectedSnapshot;
  };

  return {
    Provider,
    useActorRef: () => useContext(InnerContext),
    useSelector,
  };
})();

const InnerContext = createContext({} as AppActor);
```

### PartySocket Connection

Next, let's set up the PartySocket connection within our app machine:

```typescript
// app-machine.ts
import { fromCallback, sendTo, setup } from "xstate";
import { z } from "zod";
import { TodoClientEventSchema } from "@/schemas";
import type { TodoPersistedSnapshot } from "@/server/todo.machine";
import type { TodoClientEventProps } from "@/types";
import PartySocket from "partysocket";

export type AppEvent = TodoClientEventProps;

const AppContextSchema = z.object({
  userId: z.string(),
  connectionId: z.string(),
  connectionToken: z.string(),
  url: z.string(),
  host: z.string(),
  todoSnapshot: z.custom<TodoPersistedSnapshot>(),
});
export type AppContext = z.infer<typeof AppContextSchema>;

export const createAppMachine = () =>
  setup({
    actors: {
      connectToServer: fromCallback(
        ({
          input,
          sendBack,
          receive,
        }: {
          input: {
            userId: string;
            host: string;
            connectionId: string;
            connectionToken: string;
            url: string;
          };
          sendBack: (event: AppEvent) => void;
          receive: (listener: (event: AppEvent) => void) => void;
        }) => {
          const socket = new PartySocket({
            host: input.host,
            party: "todo",
            room: input.userId,
            id: input.connectionId,
            query: { token: input.connectionToken },
          });

          receive((event) => {
            socket.send(JSON.stringify(event));
          });

          socket.addEventListener("message", (message: MessageEvent<string>) => {
            const event = JSON.parse(message.data);
            if (TodoClientEventSchema.safeParse(event).success) {
              sendBack(event);
            }
          });

          return () => {
            socket.close();
          };
        }
      ),
    },
    types: {
      events: {} as AppEvent,
      context: {} as AppContext,
      input: {} as {
        userId: string;
        host: string;
        connectionId: string;
        connectionToken: string;
        url: string;
        initialSnapshot: TodoPersistedSnapshot;
      },
    },
  }).createMachine({
    id: "AppMachine",
    type: "parallel",
    context: ({ input }) => ({
      userId: input.userId,
      connectionId: input.connectionId,
      connectionToken: input.connectionToken,
      url: input.url,
      host: input.host,
      todoSnapshot: input.initialSnapshot,
    }),
    states: {
      Server: {
        initial: "Connecting",
        states: {
          Connecting: {
            invoke: {
              id: "serverConnection",
              src: "connectToServer",
              input: ({ context }) => ({
                userId: context.userId,
                host: context.host,
                connectionId: context.connectionId,
                connectionToken: context.connectionToken,
                url: context.url,
              }),
              onDone: "Connected",
              onError: "ConnectionFailed",
            },
          },
          Connected: {
            on: {
              "*": {
                actions: sendTo("serverConnection", ({ event }) => event),
              },
            },
          },
          ConnectionFailed: {
            after: {
              5000: "Connecting",
            },
          },
        },
      },
    },
  });

export type AppMachine = ReturnType<typeof createAppMachine>;
export type AppSnapshot = SnapshotFrom<AppMachine>;
export type AppActor = Actor<AppMachine>;
```

### Using the App Context in Components

Finally, here's how you might use the `AppContext` in your components:

```typescript
// TodoList.tsx
import { AppContext } from "~/components/app-context";

export function TodoList() {
  const todos = AppContext.useSelector((state) => state.context.todoSnapshot.todos);
  const actor = AppContext.useActorRef();

  const addTodo = (text: string) => {
    actor.send({ type: "ADD_TODO", text });
  };

  const toggleTodo = (id: string) => {
    actor.send({ type: "TOGGLE_TODO", id });
  };

  const removeTodo = (id: string) => {
    actor.send({ type: "REMOVE_TODO", id });
  };

  return (
    <div>
      {/* Render your todo list here */}
      {todos.map((todo) => (
        <div key={todo.id}>
          <span>{todo.text}</span>
          <button onClick={() => toggleTodo(todo.id)}>
            {todo.completed ? "Mark Incomplete" : "Mark Complete"}
          </button>
          <button onClick={() => removeTodo(todo.id)}>Remove</button>
        </div>
      ))}
      {/* Add a form to add new todos */}
    </div>
  );
}
```

This setup allows you to:

1. Manage your application state using XState.
2. Establish a real-time connection with your server using PartySocket.
3. Provide a consistent way to access and update your todo list state across your application.

Remember to wrap your main application component with the `AppContext.Provider` as shown in the earlier example:

```typescript
export default function TodoApp() {
  const data = useLoaderData<typeof loader>();
  const location = useLocation();

  return (
    <AppContext.Provider
      input={{
        userId: data.connectionId,
        connectionId: data.connectionId,
        connectionToken: data.token,
        host: data.host,
        url: location.pathname + location.search,
        initialSnapshot: data.snapshot as TodoPersistedSnapshot,
      }}
    >
      <TodoList />
      {/* Other components */}
    </AppContext.Provider>
  );
}
```