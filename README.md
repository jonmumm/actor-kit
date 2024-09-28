# Actor Kit

Actor Kit is a library for creating and managing actor-based state machines (via XState) in Cloudflare Workers. It provides a framework for handling different types of events from various sources and manages the lifecycle of actors.

## Installation

To install Actor Kit, use your preferred package manager:

```bash
npm install actor-kit xstate zod partykit
# or
yarn add actor-kit xstate zod partykit
# or
pnpm add actor-kit xstate zod partykit
```

## Usage

Here's a barebones example of how to use Actor Kit to create a todo list application with Next.js, fetching data server-side.

### Actor Server State Machine Setup

Setup your actor by defining events, context shape, and state machine logic.

```typescript
// file: src/server/todo.actor.ts
import { setup } from "xstate";
import { createMachineServer } from "actor-kit/server";
import { createActorFetch } from "actor-kit/fetch";
import { z } from "zod";

// Define event schemas
const TodoClientEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("ADD_TODO"), text: z.string() }),
  z.object({ type: z.literal("TOGGLE_TODO"), id: z.string() }),
  z.object({ type: z.literal("DELETE_TODO"), id: z.string() }),
]);

const TodoServiceEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("SYNC_TODOS"),
    todos: z.array(
      z.object({ id: z.string(), text: z.string(), completed: z.boolean() })
    ),
  }),
]);

// Define the state machine
export const createTodoListMachine = setup({
  types: {
    context: {} as {
      public: {
        todos: Array<{ id: string; text: string; completed: boolean }>;
        lastSync: Date | null;
      };
      private: Record<
        string,
        {
          lastAccessTime?: Date;
          userPreferences?: {
            theme: "light" | "dark";
            sortOrder: "asc" | "desc";
          };
        }
      >;
    },
    events: {} as TodoClientEvent | TodoServiceEvent,
  },
}).createMachine({
  // ... machine configuration
});

// Create your actor server from the machine and event schemas
export const TodoListServer = createMachineServer(
  createTodoListMachine,
  {
    client: TodoClientEventSchema,
    service: TodoServiceEventSchema,
  },
  {
    persisted: true,
  }
);

const TodoMachine = ReturnType<typeof createTodoListMachine>;
export const fetchTodoActor = createActorFetch<TodoMachine>("todo");
```

Create a file to export the server.

```typescript
// file: src/server/todo.server.ts
import { createMachineServer } from "actor-kit/server";
import {
  createTodoListMachine,
  TodoClientEventSchema,
  TodoServiceEventSchema,
} from "./todo.actor";

const TodoListServer = createMachineServer(
  createTodoListMachine,
  {
    client: TodoClientEventSchema,
    service: TodoServiceEventSchema,
  },
  {
    persisted: true,
  }
);

export default TodoListServer;
```

### PartyKit Configuration

Actor Kit is built on top of PartyKit, so you need to configure your project to use PartyKit. Create a `partykit.json` file in the root of your project with the following content:

```json
{
  "name": "your-project-name",
  "parties": {
    "todo": "src/server/todo.server.ts"
  },
}
```

For more information on PartyKit configuration, refer to the [PartyKit documentation](https://docs.partykit.io/reference/partykit-json/).

### Server-side Data Fetching

In your web server, use the `fetchTodoActor` function you created above to fetch the current snapshot and initialize a connection to the server. Server components pass this initial data down to the client to connect to the actor and listens for changes.

```typescript
// app/todo/[id]/page.tsx
import { fetchTodoActor } from "../server/todo.actor";
import { createActorKitContext } from "actor-kit/react";
import TodoClient from "./TodoClient";
import { getUserId } from "../my-auth-system";

const TodoActorKitContext = createActorKitContext<TodoClientEvent, TodoSnapshot>();

export default async function TodoPage({ params }: { params: { id: string } }) {
  const userId = getUserId(); // Get the user ID from your authentication system
  const { snapshot, connectionId, connectionToken } = await fetchTodoActor({
    id: params.id,
    callerId: userId,
  });

  return (
    <TodoActorKitContext.Provider
      options={{
        host: process.env.ACTOR_KIT_HOST!,
        actorType: "todo",
        actorId: params.id,
        connectionId,
        connectionToken,
        initialState: snapshot,
      }}
    >
      <TodoList />
    </TodoActorKitContext.Provider>
  );
}

function TodoList() {
  const todos = TodoActorKitContext.useSelector((state) => state.public.todos);
  const send = TodoActorKitContext.useSend();

  // Implement your todo list UI here
  return (
    <ul>
      {todos.map((todo) => (
        <li key={todo.id}>
          {todo.text}
          <button onClick={() => send({ type: "TOGGLE_TODO", id: todo.id })}>
            {todo.completed ? "Undo" : "Complete"}
          </button>
        </li>
      ))}
    </ul>
  );
}
```

Make sure to set the appropriate environment variables (`ACTOR_KIT_HOST`, `ACTOR_KIT_SECRET`) in your Next.js app.

## API Reference

### `actor-kit/fetch`

#### `createActorFetch<TMachine>(actorType)`

Creates a function for fetching actor data. Used in a trusted server environment.

- `TMachine`: Type parameter representing the state machine type.
- `actorType`: String identifier for the actor type.

Returns a function `(props: object) => Promise<{ snapshot: CallerSnapshot, connectionId: string, connectionToken: string }>` that fetches a snapshot of the actor data.

The returned fetch function takes the following props:

- `id`: ID of the actor to fetch
- `callerId`: ID of the caller (typically a user id or identifier for a service)
- `host`: (Optional) Override the default Actor Kit host (default: process.env.ACTOR_KIT_HOST)
- `signingKey`: (Optional) Override the default Actor Kit signing key (default: process.env.ACTOR_KIT_SECRET)

### `actor-kit/server`

#### `createMachineServer(createMachine, eventSchemas, options?)`

Creates an actor server for use with PartyKit.

- `createMachine`: Function that creates the state machine.
- `eventSchemas`: Object containing Zod schemas for different event types.
  - `client`: Schema for events from clients
  - `service`: Schema for events from services
- `options`: (Optional) Additional options for the server.
  - `persisted`: Whether to persist the actor state (default: false)

Returns an `ActorServer` class implementing the `Party.Server` interface.

### `actor-kit/browser`

#### `createActorKitClient<TClientEvent, TSnapshot>(options)`

Creates an Actor Kit client for managing state and communication with the server.

- `options`: Configuration options for the client.
  - `host: string`: Hostname of the PartyKit server.
  - `actorType: string`: Type of the actor (e.g., "todo", "player").
  - `actorId: string`: Unique identifier for the specific actor instance.
  - `connectionId: string`: Unique identifier for the client connection.
  - `connectionToken: string`: Authentication token for the connection.
  - `initialState: TSnapshot`: Initial client state.
  - `onStateChange?: (newState: TSnapshot) => void`: Optional state change callback.
  - `onError?: (error: Error) => void`: Optional error handler.

Returns an `ActorKitClient<TClientEvent, TSnapshot>` object with methods:

- `connect(): Promise<void>`: Establishes a WebSocket connection to the server.
- `disconnect(): void`: Closes the WebSocket connection.
- `send(event: TClientEvent): void`: Sends an event to the server.
- `getState(): TSnapshot`: Returns the current state.
- `subscribe(listener: (state: TSnapshot) => void): () => void`: Subscribes to state changes.

### `actor-kit/react`

#### `createActorKitContext<TClientEvent, TSnapshot>()`

Creates a React context for Actor Kit integration.

Returns an object with:

- `Provider`: React component to provide the Actor Kit client.
- `useClient()`: Hook to access the Actor Kit client directly.
- `useSelector(selector)`: Hook to select and subscribe to state only when it changes.
- `useSend()`: Hook to get a function for sending events to the Actor Kit client.

## Types

The following types are exported from the main `actor-kit` package:

### `WithActorKitEvent<TEvent, TCallerType>`

Utility type that wraps an event type with Actor Kit-specific properties.

- `TEvent`: Base event type.
- `TCallerType`: Type of caller ("client" or "service").

### `CallerSnapshotFrom<TMachine>`

Utility type to extract the caller-specific snapshot from a machine type.

### `ActorKitStateMachine`

Type definition for an Actor Kit state machine, extending XState's `StateMachine` type. Requires `public` and `private` to be specified in the `context`.

## Public and Private Data

Actor Kit supports the concepts of public and private data in the context. This allows you to manage shared data across all clients and caller-specific information.

### Defining Public and Private Data

In your state machine, define the public and private data as part of the context:

```typescript
setup({
  types: {
    context: {} as {
      public: {
        // Data shared across all clients
        todos: Array<{ id: string; text: string; completed: boolean }>;
        lastSync: Date | null;
      };
      private: {} as Record<string, {
        // Caller-specific data
        lastAccessTime?: Date;
        userPreferences?: {
          theme: "light" | "dark";
          sortOrder: "asc" | "desc";
        };
      }>;
    },
    // ... other type definitions
  },
  // ... rest of the machine definition
});
```

### Persistent vs Synced Snapshots

In the persistent snapshot, both `public` and `private` data are stored in the `context`. In the synced snapshot (what clients receive), `public` data is shared across all clients, while `private` data is limited to the matching caller. All other context keys (like `history` in the example) are excluded when syncing.

## Caller Types

Actor Kit supports different types of callers:

- `client`: Events from end-users or client applications
- `system`: Internal events generated by the actor system (handled internally)
- `service`: Events from trusted external services or internal microservices