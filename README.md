# 🎭 Actor Kit

Actor Kit is a powerful library for creating and managing actor-based state machines in Cloudflare Workers, leveraging XState for robust state management. It provides a comprehensive framework for handling different types of events from various sources and manages the lifecycle of actors in a distributed environment.

## 📚 Table of Contents

- [💾 Installation](#-installation)
- [🌟 Key Concepts](#-key-concepts)
- [🛠️ Usage](#️-usage)
  - [1️⃣ Define your event schemas and types](#1️⃣-define-your-event-schemas-and-types)
  - [2️⃣ Define your state machine](#2️⃣-define-your-state-machine)
  - [3️⃣ Set up the Actor Server](#3️⃣-set-up-the-actor-server)
  - [4️⃣ Configure Wrangler](#4️⃣-configure-wrangler)
  - [5️⃣ Create a Cloudflare Worker with Actor Kit Router](#5️⃣-create-a-cloudflare-worker-with-actor-kit-router)
  - [6️⃣ Create the Actor Kit Context](#6️⃣-create-the-actor-kit-context)
  - [7️⃣ Fetch data server-side](#7️⃣-fetch-data-server-side)
  - [8️⃣ Create a client-side component](#8️⃣-create-a-client-side-component)
- [🚀 Getting Started](#-getting-started)
- [🗂️ Framework Examples](#-framework-examples)
  - [⚛️ Next.js](/examples/nextjs-actorkit-todo/README.md)
  - [🎸 Remix](/examples/remix-actorkit-todo/README.md)
- [📖 API Reference](#-api-reference)
  - [🔧 actor-kit/worker](#-actor-kitworker)
  - [🖥️ actor-kit/server](#️-actor-kitserver)
  - [🌐 actor-kit/browser](#-actor-kitbrowser)
  - [⚛️ actor-kit/react](#️-actor-kitreact)
- [🔑 TypeScript Types](#-typescript-types)
- [👥 Caller Types](#-caller-types)
- [🔐 Public and Private Data](#-public-and-private-data)
- [📜 License](#-license)

## 💾 Installation

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
- 🛡️ **Type Safety**: Leverage TypeScript and Zod for robust type checking and runtime validation.
- 🎭 **Event-Driven Architecture**: All state changes are driven by events, providing a clear and predictable data flow.
- 🧠 **State Machine Logic**: Powered by XState, making complex state management more manageable and visualizable.
- 🔄 **Seamless Synchronization**: Actor Kit handles state synchronization between server and clients automatically.
- 🔐 **Public and Private Data**: Manage shared data across all clients and caller-specific information securely.
- 🌐 **Distributed Systems**: Built for scalable, distributed applications running on edge computing platforms.

## 🛠️ Usage

Here's a comprehensive example of how to use Actor Kit to create a todo list application with Next.js and Cloudflare Workers:

### 1️⃣ Define your event schemas and types

First, define the schemas and types for your events:

```typescript
// src/server/todo.schemas.ts
import { z } from "zod";

export const TodoClientEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("ADD_TODO"),
    text: z.string(),
  }),
  z.object({
    type: z.literal("TOGGLE_TODO"),
    id: z.string(),
  }),
  z.object({
    type: z.literal("DELETE_TODO"),
    id: z.string(),
  }),
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
import type { WithActorKitEvent, ActorKitSystemEvent } from "actor-kit";
import { z } from "zod";
import { TodoClientEventSchema, TodoServiceEventSchema } from "./todo.schemas";

export type TodoClientEvent = z.infer<typeof TodoClientEventSchema>;
export type TodoServiceEvent = z.infer<typeof TodoServiceEventSchema>;

export type TodoEvent =
  | WithActorKitEvent<TodoClientEvent, "client">
  | WithActorKitEvent<TodoServiceEvent, "service">
  | ActorKitSystemEvent;
```

### 2️⃣ Define your state machine

Now that we have our event types defined, we can create our state machine:

```typescript
// src/server/todo.machine.ts
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
        private: Record<string, { lastAccessTime?: number }>;
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
      // ... other actions ...
    },
    guards: {
      // ... guards ...
    },
  }).createMachine({
    id: "todoList",
    initial: "idle",
    context: {
      public: {
        ownerId: caller.id,
        todos: [],
        lastSync: null,
      },
      private: {},
    },
    states: {
      idle: {
        on: {
          ADD_TODO: {
            actions: "addTodo",
          },
          // ... other transitions ...
        },
      },
      // ... other states ...
    },
  });
```

### 3️⃣ Set up the Actor Server

Create the Actor Server using the `createMachineServer` function:

```typescript
// src/server/todo.server.ts
import { createMachineServer } from "actor-kit/worker";
import { createTodoListMachine } from "./todo.machine";
import { TodoClientEventSchema, TodoServiceEventSchema } from "./todo.schemas";

export const TodoActorKitServer = createMachineServer({
  createMachine: createTodoListMachine,
  eventSchemas: {
    client: TodoClientEventSchema,
    service: TodoServiceEventSchema,
  },
  options: {
    persisted: true,
  },
});
```

### 4️⃣ Configure Wrangler

Create a `wrangler.toml` file in your project root:

```toml
name = "nextjs-actorkit-todo"
main = "src/server/main.ts"
compatibility_date = "2024-09-25"

[vars]
ACTOR_KIT_SECRET = "foobarbaz"

[[durable_objects.bindings]]
name = "TODO"
class_name = "Todo"

[[migrations]]
tag = "v1"
new_classes = ["Todo"]
```

### 5️⃣ Create a Cloudflare Worker with Actor Kit Router

Create a new file, e.g., `src/server/main.ts`, to set up your Cloudflare Worker:

```typescript
// src/server/main.ts
import { createActorKitRouter } from "actor-kit/worker";
import { TodoActorKitServer } from "./todo.server";

const actorKitRouter = createActorKitRouter(["todo"]);

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);

    // Handle Actor Kit routes
    if (url.pathname.startsWith("/api/")) {
      return actorKitRouter(request, env, ctx);
    }

    // Handle other routes or return a default response
    return new Response("Welcome to Actor Kit on Cloudflare Workers!");
  },
};
```

### 6️⃣ Create the Actor Kit Context

```typescript
// src/shared/todo.context.tsx
"use client";

import type { TodoMachine } from "./todo.machine";
import { createActorKitContext } from "actor-kit/react";

export const TodoActorKitContext = createActorKitContext<TodoMachine>("todo");
export const TodoActorKitProvider = TodoActorKitContext.Provider;
```

### 7️⃣ Fetch data server-side

```typescript
// src/app/lists/[id]/page.tsx
import { getUserId } from "@/session";
import { createAccessToken, createActorFetch } from "actor-kit/server";
import { TodoActorKitProvider } from "./todo.context";
import type { TodoMachine } from "./todo.machine";
import { TodoList } from "./components";

const host = process.env.ACTOR_KIT_HOST!;
const signingKey = process.env.ACTOR_KIT_SECRET!;

const fetchTodoActor = createActorFetch<TodoMachine>({
  actorType: "todo",
  host,
});

export default async function TodoPage(props: { params: { id: string } }) {
  const listId = props.params.id;
  const userId = await getUserId();

  const accessToken = await createAccessToken({
    signingKey,
    actorId: listId,
    actorType: "todo",
    callerId: userId,
    callerType: "client",
  });

  const payload = await fetchTodoActor({
    actorId: listId,
    accessToken,
  });

  return (
    <TodoActorKitProvider
      host={host}
      actorId={listId}
      accessToken={accessToken}
      checksum={payload.checksum}
      initialSnapshot={payload.snapshot}
    >
      <TodoList />
    </TodoActorKitProvider>
  );
}
```

### 8️⃣ Create a client-side component

```typescript
// src/app/lists/[id]/components.tsx
"use client";

import React, { useState } from "react";
import { TodoActorKitContext } from "./todo.context";

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

This example demonstrates how to set up and use Actor Kit in a Next.js application with Cloudflare Workers, including:

1. Defining event schemas and types
2. Creating the state machine with proper typing
3. Setting up the Actor Server
4. Configuring Wrangler for Cloudflare Workers
5. Creating a Cloudflare Worker with Actor Kit Router
6. Setting up the Actor Kit context
7. Fetching data server-side with access token creation
8. Creating a client-side component that interacts with the actor

## 🚀 Getting Started

1. Install dependencies:

   ```bash
   npm install actor-kit xstate zod
   npm install -D wrangler
   ```

2. Set up environment variables:

   - `ACTOR_KIT_SECRET`: Secret key for Actor Kit (required by Actor Kit to verify incoming requests and by external services to sign outgoing requests)
   - `ACTOR_KIT_HOST`: The host for your Actor Kit server (only required for external access, e.g., from a Next.js server)

3. Create a `wrangler.toml` file in your project root:

   ```toml
   name = "your-project-name"
   main = "src/server/worker.ts"
   compatibility_date = "2023-12-22"

   [vars]
   ACTOR_KIT_SECRET = "foo-bar-buzz-bar"

   # Durable Object bindings
   [[durable_objects.bindings]]
   name = "TodoActorKitServer"
   class_name = "TodoActorKitServer"

   # Durable Object migrations
   [[migrations]]
   tag = "v1"
   new_classes = ["TodoActorKitServer"]
   ```

   Notes:

   - Ensure that `ACTOR_KIT_SECRET` is kept secure and not exposed publicly.
   - The `durable_objects.bindings` section creates a binding between your Worker and the Durable Object classes that implement your actor servers.
   - The `migrations` section is necessary to create the Durable Object classes in your Cloudflare account.

4. Create your Worker script (e.g., `src/server/worker.ts`):

   ```typescript
   import { createActorKitRouter } from "actor-kit/worker";
   import { TodoActorKitServer } from "./todo.server";

   const actorKitRouter = createActorKitRouter({
     todo: TodoActorKitServer,
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
         return actorKitRouter(request, env, ctx);
       }

       // Handle other routes, return a default response, or set up a web rendering framework
       return new Response("Hello World!");
     },
   };
   ```

5. Start the Cloudflare Worker development server:

   ```bash
   npx wrangler dev
   ```

6. Deploy your Worker to Cloudflare:

   ```bash
   npx wrangler deploy
   ```

7. If you're using Next.js or another external server, set up your `ACTOR_KIT_HOST` environment variable to point to your deployed Worker's URL, then run your development server:

   ```bash
   npm run dev
   ```

By following these steps, you'll have set up your Cloudflare Worker with the necessary Durable Object bindings to run your Actor Kit servers, implemented the `createActorKitRouter` to handle routing to the appropriate Durable Objects, and deployed your Worker to Cloudflare's edge network.

## 🗂️ Framework Examples

Actor Kit includes example todo list applications demonstrating integration with popular web frameworks.

Directory structure:

- `shared/`: Contains common Actor Kit setup (machine, schemas, types) not specific to any framework
- `examples/`:
  - `nextjs-actorkit-todo/`: [Next.js example](/examples/nextjs-actorkit-todo/README.md)
  - `remix-actorkit-todo/`: [Remix example](/examples/remix-actorkit-todo/README.md)

Each example showcases how to structure an Actor Kit project within its respective framework, providing a practical reference for integrating Actor Kit into your applications.

## 📖 API Reference

### 🔧 `actor-kit/worker`

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

### 🖥️ `actor-kit/server`

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
      host: process.env.ACTOR_KIT_HOST!,
      signingKey: process.env.ACTOR_KIT_SECRET!,
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

### 🌐 `actor-kit/browser`

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
  host: "your-actor-kit-server.com",
  actorType: "todo",
  actorId: "list-123",
  checksum: "wf8ew9a",
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

### ⚛️ `actor-kit/react`

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

## 👥 Caller Types

Actor Kit supports different types of callers, each with its own level of trust and permissions:

- 👤 `client`: Events from end-users or client applications
- 🤖 `system`: Internal events generated by the actor system (handled internally)
- 🔧 `service`: Events from trusted external services or internal microservices

## 🔑 TypeScript Types

The following key types are exported from the main `actor-kit` package:

### `WithActorKitEvent<TEvent, TCallerType>`

Utility type that wraps an event type with Actor Kit-specific properties. This is crucial for adding caller information and other metadata to your events.

Example usage:

```typescript
import { WithActorKitEvent } from "actor-kit";

type MyClientEvent =
  | { type: "ADD_TODO"; text: string }
  | { type: "TOGGLE_TODO"; id: string };

type MyServiceEvent = {
  type: "SYNC_TODOS";
  todos: Array<{ id: string; text: string; completed: boolean }>;
};

type MyEvent =
  | WithActorKitEvent<MyClientEvent, "client">
  | WithActorKitEvent<MyServiceEvent, "service">
  | ActorKitSystemEvent;
```

### `ActorKitSystemEvent`

Type representing system events that Actor Kit generates internally. These events are automatically included in your machine's event type and are used to handle lifecycle operations.

Key system events:

- `INITIALIZE`: Fired when an actor is first created or resumed from storage.
- `CONNECT`: Fired when a client connects to the actor.
- `DISCONNECT`: Fired when a client disconnects from the actor.

Example usage in a state machine:

```typescript
createMachine({
  // ... other configuration ...
  states: {
    idle: {
      on: {
        INITIALIZE: {
          actions: "initializeActor",
        },
        CONNECT: {
          actions: "handleClientConnection",
        },
        DISCONNECT: {
          actions: "handleClientDisconnection",
        },
        // ... other transitions ...
      },
    },
    // ... other states ...
  },
});
```

### `CallerSnapshotFrom<TMachine>`

Utility type to extract the caller-specific snapshot from a machine type. This is useful when working with the state in your components or actions.

Example usage:

```typescript
import { CallerSnapshotFrom } from "actor-kit";
import { TodoMachine } from "./todo.machine";

type TodoSnapshot = CallerSnapshotFrom<TodoMachine>;

function TodoList({ snapshot }: { snapshot: TodoSnapshot }) {
  return (
    <ul>
      {snapshot.public.todos.map((todo) => (
        <li key={todo.id}>{todo.text}</li>
      ))}
    </ul>
  );
}
```

### Other Types

- `ActorKitStateMachine`: Type definition for an Actor Kit state machine, extending XState's `StateMachine` type.
- `ClientEventFrom<TMachine>`: Utility type to extract client events from an Actor Kit state machine.

By including these types in your Actor Kit implementation, you ensure type safety and proper handling of events and state across your application.

## 🔐 Public and Private Data

Actor Kit supports the concepts of public and private data in the context. This allows you to manage shared data across all clients and caller-specific information securely.

## 📜 License

Actor Kit is [MIT licensed](LICENSE.md).
