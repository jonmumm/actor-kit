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

After reviewing the current example in the README and comparing it with the provided code snippets from the actual implementation, I can see that there are some differences. We should update the example in the README to better reflect the current implementation. Here's a suggested update:

## Usage

Here's a barebones example of how to use Actor Kit to create a todo list application with Next.js, fetching data server-side.

### Actor Server State Machine Setup

Setup your actor by defining events, context shape, and state machine logic.

```typescript
// file: src/server/todo.actor.ts
import type { CreateMachineProps } from "actor-kit";
import { assign, setup } from "xstate";
import type { TodoEvent } from "./todo.types";

export const createTodoListMachine = ({ id }: CreateMachineProps) =>
  setup({
    types: {
      context: {} as {
        public: {
          todos: Array<{ id: string; text: string; completed: boolean }>;
          lastSync: number | null;
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
      events: {} as TodoEvent,
    },
    actions: {
      addTodo: assign({
        public: ({ context, event }) => {
          if (event.type !== "ADD_TODO") return context.public;
          return {
            ...context.public,
            todos: [
              ...context.public.todos,
              { id: crypto.randomUUID(), text: event.text, completed: false },
            ],
            lastSync: new Date().getTime(),
          };
        },
      }),
      // ... other actions (toggleTodo, deleteTodo)
    },
  }).createMachine({
    id,
    type: "parallel",
    context: {
      public: {
        todos: [],
        lastSync: null,
      },
      private: {},
    },
    states: {
      TodoManagement: {
        on: {
          ADD_TODO: {
            actions: ["addTodo"],
          },
          // ... other event handlers
        },
      },
    },
  });

export type TodoMachine = ReturnType<typeof createTodoListMachine>;
```

Create a file to export the server.

```typescript
// file: src/server/todo.server.ts
import { createMachineServer } from "actor-kit/worker";
import { createTodoListMachine } from "./todo.actor";
import { TodoClientEventSchema, TodoServiceEventSchema } from "./todo.schemas";

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

### Server-side Data Fetching

In your Next.js app, use the `createActorFetch` function to fetch the current snapshot and initialize a connection to the server.

```typescript
// app/page.tsx
import { createActorFetch } from "actor-kit/server";
import type { TodoMachine } from "../server/todo.actor";
import { TodoActorKitProvider } from "./context";
import TodoList from "./todolist";

const fetchTodoActor = createActorFetch<TodoMachine>("todo");

export default async function TodoPage() {
  const userId = getUserId(); // Assuming getUserId is a function that retrieves the user ID from the request or session
  const payload = await fetchTodoActor({
    actorId: userId,
    callerId: userId,
  });

  return (
    <TodoActorKitProvider
      options={{
        host: process.env.ACTOR_KIT_HOST!,
        actorType: "todo",
        actorId: userId,
        connectionId: payload.connectionId,
        connectionToken: payload.connectionToken,
        initialState: payload.snapshot,
      }}
    >
      <TodoList />
    </TodoActorKitProvider>
  );
}
```

### Client-side Component

Create a client-side component to interact with the todo list.

```typescript
// app/todolist.tsx
"use client";

import React, { useState } from "react";
import { TodoActorKitContext } from "./context";

export default function TodoList() {
  const todos = TodoActorKitContext.useSelector((state) => state.public.todos);
  const send = TodoActorKitContext.useSend();
  const [newTodoText, setNewTodoText] = useState("");

  const handleAddTodo = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTodoText.trim()) {
      send({ type: "ADD_TODO", text: newTodoText.trim() });
      setNewTodoText("");
    }
  };

  return (
    <div>
      <h1>Todo List</h1>
      <form onSubmit={handleAddTodo}>
        <input
          type="text"
          value={newTodoText}
          onChange={(e) => setNewTodoText(e.target.value)}
          placeholder="Add a new todo"
        />
        <button type="submit">Add</button>
      </form>
      <ul>
        {todos.map((todo) => (
          <li key={todo.id}>
            <span
              style={{
                textDecoration: todo.completed ? "line-through" : "none",
              }}
            >
              {todo.text}
            </span>
            <button onClick={() => send({ type: "TOGGLE_TODO", id: todo.id })}>
              {todo.completed ? "Undo" : "Complete"}
            </button>
            <button onClick={() => send({ type: "DELETE_TODO", id: todo.id })}>
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

Make sure to set the appropriate environment variables (`ACTOR_KIT_HOST`, `ACTOR_KIT_SECRET`) in your Next.js app.

## API Reference

### `actor-kit/worker`

#### `createMachineServer(createMachine, eventSchemas, options?)`

Creates an actor server to run on a Cloudflare Worker.

- `createMachine`: Function that creates the state machine.
- `eventSchemas`: Object containing Zod schemas for different event types.
  - `client`: Schema for events from clients
  - `service`: Schema for events from services
- `options`: (Optional) Additional options for the server.
  - `persisted`: Whether to persist the actor state (default: false)

Returns an `ActorServer` class implementing the `Party.Server` interface.

### `actor-kit/server`

#### `createActorFetch<TMachine>(actorType)`

Creates a function for fetching actor data. Used in a trusted server environment.

- `TMachine`: Type parameter representing the state machine type.
- `actorType`: String identifier for the actor type.

Returns a function `(props: object) => Promise<{ snapshot: CallerSnapshot, connectionId: string, connectionToken: string }>` that fetches a snapshot of the actor data.

The returned fetch function takes the following props:

- `actorId`: ID of the actor to fetch
- `callerId`: ID of the caller (typically a user id or identifier for a service)
- `host`: (Optional) Override the default Actor Kit host (default: process.env.ACTOR_KIT_HOST)
- `signingKey`: (Optional) Override the default Actor Kit signing key (default: process.env.ACTOR_KIT_SECRET)
- `waitFor`: (Optional) A predicate function that waits for a specific condition to be met in the actor's state before returning

#### `waitFor<TMachine>(predicate: (snapshot: CallerSnapshotFrom<TMachine>) => boolean, options?: WaitForOptions)`

Creates a predicate function that can be passed to `createActorFetch` to wait for a specific condition in the actor's state.

- `predicate`: A function that takes the current snapshot and returns a boolean indicating if the condition is met.
- `options`: (Optional) Configuration options for the wait operation.
  - `timeout`: Maximum time to wait (in milliseconds) before timing out.
  - `interval`: Time between checks (in milliseconds).

Returns a function compatible with the `waitFor` option in `createActorFetch`.

### `actor-kit/react`

#### `createActorKitContext<TMachine>()`

Creates a React context for Actor Kit integration.

Returns an object with:

- `Provider`: React component to provide the Actor Kit client.
- `useClient()`: Hook to access the Actor Kit client directly.
- `useSelector(selector)`: Hook to select and subscribe to state only when it changes.
- `useSend()`: Hook to get a function for sending events to the Actor Kit client.

### `actor-kit/browser`

#### `createActorKitClient<TMachine>(props)`

Creates an Actor Kit client for managing state and communication with the server.

- `props`: Configuration options for the client.
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