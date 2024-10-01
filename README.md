# 🎭 Actor Kit

Actor Kit is a powerful library for creating and managing actor-based state machines in Cloudflare Workers, leveraging XState for robust state management. It provides a comprehensive framework for handling different types of events from various sources and manages the lifecycle of actors in a distributed environment.

## Table of Contents

- [🚀 Installation](#-installation)
- [🌟 Key Concepts](#-key-concepts)
- [🛠️ Usage](#️-usage)
  - [1. Define your state machine](#1-define-your-state-machine)
  - [2. Set up the Actor Server](#2-set-up-the-actor-server)
  - [3. Create a Cloudflare Worker with Actor Kit Router](#3-create-a-cloudflare-worker-with-actor-kit-router)
  - [4. Define your event schemas and types](#4-define-your-event-schemas-and-types)
  - [5. Create the Actor Kit Context](#5-create-the-actor-kit-context)
  - [6. Fetch data server-side](#6-fetch-data-server-side)
  - [7. Create a client-side component](#7-create-a-client-side-component)
- [🚀 Getting Started](#-getting-started-1)
- [📚 API Reference](#-api-reference)
  - [actor-kit/worker](#actor-kitworker)
  - [actor-kit/server](#actor-kitserver)
  - [actor-kit/browser](#actor-kitbrowser)
  - [actor-kit/react](#actor-kitreact)
- [🔑 Types](#-types)
- [🔒 Public and Private Data](#-public-and-private-data)
- [👥 Caller Types](#-caller-types)
- [📄 License](#-license)

For a practical implementation, check out our [Next.js Todo List Example](/examples/nextjs-todo) which demonstrates how to integrate Actor Kit with a Next.js application to create a real-time, event-driven todo list.

## 🚀 Installation

To install Actor Kit, use your preferred package manager:

```bash
npm install actor-kit xstate zod
# or
yarn add actor-kit xstate zod
# or
pnpm add actor-kit xstate zod
```

## 🌟 Key Concepts

- 🖥️ **Server-Side Rendering**: Fetch initial state server-side for optimal performance and SEO.
- ⚡ **Real-time Updates**: Changes are immediately reflected across all connected clients, ensuring a responsive user experience.
- 🔒 **Type Safety**: Leverage TypeScript and Zod for robust type checking and runtime validation.
- 🎭 **Event-Driven Architecture**: All state changes are driven by events, providing a clear and predictable data flow.
- 🧠 **State Machine Logic**: Powered by XState, making complex state management more manageable and visualizable.
- 🔄 **Seamless Synchronization**: Actor Kit handles state synchronization between server and clients automatically.
- 🔐 **Public and Private Data**: Manage shared data across all clients and caller-specific information securely.
- 🌐 **Distributed Systems**: Built for scalable, distributed applications running on edge computing platforms.

## 🛠️ Usage

Here's a comprehensive example of how to use Actor Kit to create a todo list application with Next.js, fetching data server-side:

### 1. Define your event schemas and types

```typescript
// src/server/todo.schemas.ts
import { z } from "zod";

export const TodoClientEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("ADD_TODO"), text: z.string() }),
  z.object({ type: z.literal("TOGGLE_TODO"), id: z.string() }),
  z.object({ type: z.literal("DELETE_TODO"), id: z.string() }),
]);

export const TodoServiceEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("SYNC_TODOS"),
    todos: z.array(
      z.object({ id: z.string(), text: z.string(), completed: z.boolean() })
    ),
  }),
]);
```

```typescript
// src/server/todo.types.ts
import type { WithActorKitEvent } from "actor-kit";
import { z } from "zod";
import { TodoClientEventSchema, TodoServiceEventSchema } from "./todo.schemas";

export type TodoClientEvent = z.infer<typeof TodoClientEventSchema>;
export type TodoServiceEvent = z.infer<typeof TodoServiceEventSchema>;

export type TodoEvent =
  | WithActorKitEvent<TodoClientEvent, "client">
  | WithActorKitEvent<TodoServiceEvent, "service">;
```

### 2. Define your state machine

```typescript
// src/server/todo.actor.ts
import type { CreateMachineProps } from "actor-kit";
import { assign, setup } from "xstate";
import type { TodoEvent } from "./todo.types";

export const createTodoListMachine = ({ id, caller }: CreateMachineProps) =>
  setup({
    types: {
      context: {} as {
        public: {
          ownerId: string;
          todos: Array<{ id: string; text: string; completed: boolean }>;
          lastSync: number | null;
        };
        private: Record<string, { lastAccessTime?: Date }>;
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
            lastSync: Date.now(),
          };
        },
      }),
      toggleTodo: assign({
        public: ({ context, event }) => {
          if (event.type !== "TOGGLE_TODO") return context.public;
          return {
            ...context.public,
            todos: context.public.todos.map((todo) =>
              todo.id === event.id
                ? { ...todo, completed: !todo.completed }
                : todo
            ),
            lastSync: Date.now(),
          };
        },
      }),
      deleteTodo: assign({
        public: ({ context, event }) => {
          if (event.type !== "DELETE_TODO") return context.public;
          return {
            ...context.public,
            todos: context.public.todos.filter((todo) => todo.id !== event.id),
            lastSync: Date.now(),
          };
        },
      }),
    },
    guards: {
      isOwner: ({ context, event }) =>
        event.caller.id === context.public.ownerId,
    },
  }).createMachine({
    id,
    context: {
      public: {
        ownerId: caller.id,
        todos: [],
        lastSync: null,
      },
      private: {},
    },
    initial: "idle",
    states: {
      idle: {
        on: {
          ADD_TODO: { actions: "addTodo", guard: "isOwner" },
          TOGGLE_TODO: { actions: "toggleTodo", guard: "isOwner" },
          DELETE_TODO: { actions: "deleteTodo", guard: "isOwner" },
        },
      },
    },
  });

export type TodoMachine = ReturnType<typeof createTodoListMachine>;
```

### 3. Set up the Actor Server

```typescript
// src/server/todo.server.ts
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

### 3. Create a Cloudflare Worker with Actor Kit Router

```typescript
// src/worker.ts
import { createActorKitRouter } from "actor-kit/worker";
import TodoListServer from "./server/todo.server";

const actorKitRouter = createActorKitRouter({
  todo: TodoListServer,
});

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);

    // Handle Actor Kit routes
    if (url.pathname.startsWith("/api/")) {
      // ACTOR_KIT_SECRET is used internally here to verify incoming requests
      return actorKitRouter(request, env, ctx);
    }

    // Handle other routes
    return new Response("Hello World!");
  },
};
```

### 4. Define your event schemas and types

```typescript
// src/server/todo.schemas.ts
import { z } from "zod";

export const TodoClientEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("ADD_TODO"), text: z.string() }),
  z.object({ type: z.literal("TOGGLE_TODO"), id: z.string() }),
  z.object({ type: z.literal("DELETE_TODO"), id: z.string() }),
]);

export const TodoServiceEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("SYNC_TODOS"),
    todos: z.array(
      z.object({ id: z.string(), text: z.string(), completed: z.boolean() })
    ),
  }),
]);

// src/server/todo.types.ts
import type { WithActorKitEvent } from "actor-kit";
import { z } from "zod";
import { TodoClientEventSchema, TodoServiceEventSchema } from "./todo.schemas";

export type TodoClientEvent = z.infer<typeof TodoClientEventSchema>;
export type TodoServiceEvent = z.infer<typeof TodoServiceEventSchema>;

export type TodoEvent =
  | WithActorKitEvent<TodoClientEvent, "client">
  | WithActorKitEvent<TodoServiceEvent, "service">;
```

### 5. Create the Actor Kit Context

```typescript
// src/app/lists/[id]/context.tsx
"use client";

import { TodoMachine } from "@/server/todo.actor";
import { createActorKitContext } from "actor-kit/react";

export const TodoActorKitContext = createActorKitContext<TodoMachine>("todo");
export const TodoActorKitProvider = TodoActorKitContext.Provider;
```

### 6. Fetch data server-side

```typescript
// src/app/lists/[id]/page.tsx
import { createActorFetch } from "actor-kit/server";
import type { TodoMachine } from "../../../server/todo.actor";
import { TodoList } from "./components";
import { TodoActorKitProvider } from "./context";

const fetchTodoActor = createActorFetch<TodoMachine>("todo");

export default async function TodoPage({ params }: { params: { id: string } }) {
  const listId = params.id;
  const userId = "user-123"; // Replace with actual user ID logic

  const payload = await fetchTodoActor({
    actorId: listId,
    callerId: userId,
  });

  return (
    <TodoActorKitProvider
      options={{
        host: process.env.ACTOR_KIT_HOST!, // Required for external access
        actorId: listId,
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

### 7. Create a client-side component

```typescript
// app/lists/[id]/components.tsx
"use client";

import React, { useState } from "react";
import { TodoActorKitContext } from "./context";

export function TodoList() {
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

This comprehensive example demonstrates how to set up and use Actor Kit in a Next.js application, including:

1. Defining the state machine with proper typing
2. Setting up the Actor Server
3. Creating event schemas and types
4. Setting up the Actor Kit context
5. Fetching data server-side
6. Creating a client-side component that interacts with the actor

By following this structure, you can create robust, type-safe, and real-time applications using Actor Kit and Next.js.

## 🚀 Getting Started

1. Install dependencies:

   ```bash
   npm install actor-kit xstate zod
   ```

2. Set up environment variables:

   - `ACTOR_KIT_SECRET`: Secret key for Actor Kit (required by Actor Kit to verify incoming requests and by external services to sign outgoing requests)
   - `ACTOR_KIT_HOST`: The host for your Actor Kit server (only required for external access, e.g., from a Next.js server)

3. Create a `wrangler.toml` file in your project root:

   ```toml
   name = "your-project-name"
   main = "src/worker.ts"
   compatibility_date = "2023-12-22"

   [vars]
   ACTOR_KIT_SECRET = "your-secret-key"
   ```

   Note: Ensure that `ACTOR_KIT_SECRET` is kept secure and not exposed publicly.

4. Start the Cloudflare Worker development server:

   ```bash
   npx wrangler dev
   ```

5. If you're using Next.js or another external server, run it in a separate terminal:
   ```bash
   npm run dev
   ```

## 📚 API Reference

### `actor-kit/worker`

#### `createMachineServer(createMachine, eventSchemas, options?)`

Creates an actor server to run on a Cloudflare Worker.

- `createMachine`: Function that creates the state machine.
- `eventSchemas`: Object containing Zod schemas for different event types.
  - `client`: Schema for events from clients
  - `service`: Schema for events from services
- `options`: (Optional) Additional options for the server.
  - `persisted`: Whether to persist the actor state (default: false)

Returns an `ActorServer` class.

#### `createActorKitRouter(servers)`

Creates a router for handling Actor Kit requests in a Cloudflare Worker.

- `servers`: An object mapping actor types to their respective `ActorServer` instances.

Returns a function `(request: Request, env: Env, ctx: ExecutionContext) => Promise<Response>` that handles Actor Kit routing.

### `actor-kit/server`

#### `createActorFetch<TMachine>(actorType)`

Creates a function for fetching actor data. Used in a trusted server environment, typically for server-side rendering or initial data fetching.

- `TMachine`: Type parameter representing the state machine type.
- `actorType`: String identifier for the actor type.

Returns a function with the following signature:

```typescript
(
  props: {
    actorId: string;
    callerId: string;
    host?: string;
    signingKey?: string;
    input?: Record<string, unknown>;
    waitFor?: string;
  },
  options?: RequestInit
) =>
  Promise<{
    snapshot: CallerSnapshotFrom<TMachine>;
    connectionId: string;
    connectionToken: string;
  }>;
```

Parameters:

- `props`: An object containing:
  - `actorId`: Unique identifier for the specific actor instance.
  - `callerId`: Identifier for the caller (usually a user ID).
  - `host`: (Optional) The host URL for the Actor Kit server. Defaults to `process.env.ACTOR_KIT_HOST`.
  - `signingKey`: (Optional) The signing key for creating access tokens. Defaults to `process.env.ACTOR_KIT_SECRET`.
  - `input`: (Optional) Additional input data to send to the actor.
  - `waitFor`: (Optional) A condition to wait for before returning the snapshot.
- `options`: (Optional) Additional options to pass to the fetch request.

Returns a Promise that resolves to an object containing:

- `snapshot`: The current state of the actor, typed as `CallerSnapshotFrom<TMachine>`.
- `connectionId`: A unique identifier for the connection.
- `connectionToken`: An authentication token for the connection.

Example usage:

```typescript
import { createActorFetch } from "actor-kit/server";
import type { TodoMachine } from "./todo.machine";

const fetchTodoActor = createActorFetch<TodoMachine>("todo");

export async function getServerSideProps(context) {
  const { id } = context.params;
  const userId = "user-123"; // Replace with actual user ID logic

  try {
    const { snapshot, connectionId, connectionToken } = await fetchTodoActor({
      actorId: id,
      callerId: userId,
      input: { initialTodos: [] },
      waitFor: "TODOS_LOADED",
    });

    return {
      props: {
        initialState: snapshot,
        connectionId,
        connectionToken,
      },
    };
  } catch (error) {
    console.error("Failed to fetch todo actor:", error);
    return { notFound: true };
  }
}
```

This function is crucial for server-side rendering and initial data fetching in server environments. It securely retrieves the actor's state and necessary connection information, which can then be passed to the client for seamless hydration and real-time updates.

### `actor-kit/browser`

#### `createActorKitClient<TMachine>(props)`

Creates an Actor Kit client for managing state and communication with the server.

- `TMachine`: Type parameter representing the state machine type.
- `props`: Configuration options for the client.
  - `host`: The host URL for the Actor Kit server.
  - `actorType`: String identifier for the actor type.
  - `actorId`: Unique identifier for the specific actor instance.
  - `connectionId`: Unique identifier for this client connection.
  - `connectionToken`: Authentication token for the connection.
  - `initialState`: Initial state of the actor.
  - `onStateChange`: (Optional) Callback function called when the state changes.
  - `onError`: (Optional) Callback function called when an error occurs.

Returns an `ActorKitClient<TMachine>` object with the following methods:

- `connect(): Promise<void>`: Establishes a WebSocket connection to the Actor Kit server.
- `disconnect(): void`: Closes the WebSocket connection.
- `send(event: ClientEventFrom<TMachine>): void`: Sends an event to the Actor Kit server.
- `getState(): CallerSnapshotFrom<TMachine>`: Retrieves the current state of the actor.
- `subscribe(listener: (state: CallerSnapshotFrom<TMachine>) => void): () => void`: Subscribes a listener to state changes and returns an unsubscribe function.

Example usage:

```typescript
const client = createActorKitClient<TodoMachine>({
  host: "https://your-actor-kit-server.com",
  actorType: "todo",
  actorId: "list-123",
  connectionId: "user-456",
  connectionToken: "your-auth-token",
  initialState: initialTodoState,
  onStateChange: (newState) => console.log("State updated:", newState),
  onError: (error) => console.error("Actor Kit error:", error),
});

await client.connect();
client.send({ type: "ADD_TODO", text: "New task" });
const currentState = client.getState();
const unsubscribe = client.subscribe((state) => {
  console.log("State changed:", state);
});

// Later, when done:
unsubscribe();
client.disconnect();
```

This client provides a high-level interface for interacting with Actor Kit actors, managing WebSocket connections, and handling state updates in browser environments.

### `actor-kit/react`

#### `createActorKitContext<TMachine>(actorType)`

Creates a React context and associated hooks for integrating Actor Kit into a React application.

- `TMachine`: Type parameter representing the state machine type.
- `actorType`: String identifier for the actor type.

Returns an object with the following components and hooks:

- `Provider`: React component to provide the Actor Kit client to its children.

  - Props:
    - `children`: React nodes to be rendered inside the provider.
    - `options`: Configuration options for the Actor Kit client (same as `ActorKitClientProps`, excluding `actorType`).

- `useClient()`: Hook to access the Actor Kit client directly.

  - Returns: The `ActorKitClient<TMachine>` instance.
  - Throws an error if used outside of the Provider.

- `useSelector<T>(selector: (snapshot: CallerSnapshotFrom<TMachine>) => T)`: Hook to select and subscribe to specific parts of the state.

  - `selector`: A function that takes the current state snapshot and returns the desired subset of the state.
  - Returns: The selected part of the state, which will trigger a re-render only when the selected value changes.

- `useSend()`: Hook to get a function for sending events to the Actor Kit client.
  - Returns: A function of type `(event: ClientEventFrom<TMachine>) => void` for sending events.

Example usage:

```typescript
// Create the context
const TodoActorKitContext = createActorKitContext<TodoMachine>("todo");

// In your component tree
function App() {
  return (
    <TodoActorKitContext.Provider
      options={{
        host: "https://your-actor-kit-server.com",
        actorId: "list-123",
        connectionId: "user-456",
        connectionToken: "your-auth-token",
        initialState: initialTodoState,
      }}
    >
      <TodoList />
    </TodoActorKitContext.Provider>
  );
}

// In your components
function TodoList() {
  const todos = TodoActorKitContext.useSelector((state) => state.public.todos);
  const send = TodoActorKitContext.useSend();

  return (
    <ul>
      {todos.map((todo) => (
        <li key={todo.id}>
          {todo.text}
          <button onClick={() => send({ type: "TOGGLE_TODO", id: todo.id })}>
            Toggle
          </button>
        </li>
      ))}
    </ul>
  );
}
```

This context and its associated hooks provide a convenient way to integrate Actor Kit into React applications, managing the client lifecycle and providing efficient state updates.

## 🔑 Types

The following types are exported from the main `actor-kit` package:

### `WithActorKitEvent<TEvent, TCallerType>`

Utility type that wraps an event type with Actor Kit-specific properties.

### `CallerSnapshotFrom<TMachine>`

Utility type to extract the caller-specific snapshot from a machine type.

### `ActorKitStateMachine`

Type definition for an Actor Kit state machine, extending XState's `StateMachine` type. Requires public and private context types to be defined.

### `ClientEventFrom<TMachine>`

Utility type to extract client events from an Actor Kit state machine.

## 🔒 Public and Private Data

Actor Kit supports the concepts of public and private data in the context. This allows you to manage shared data across all clients and caller-specific information securely.

## 👥 Caller Types

Actor Kit supports different types of callers, each with its own level of trust and permissions:

- 👤 `client`: Events from end-users or client applications
- 🤖 `system`: Internal events generated by the actor system (handled internally)
- 🔧 `service`: Events from trusted external services or internal microservices

## 📄 License

Actor Kit is [MIT licensed](LICENSE.md).