# 🎭 Actor Kit

Actor Kit is a library for running state machines in Cloudflare Workers, leveraging XState for robust state management. It provides a framework for managing the logic, lifecycle, persistence, synchronization, and access control of actors in a distributed environment.

## 📚 Table of Contents

- [💾 Installation](#-installation)
- [🏗️ Architecture](#️-architecture)
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
- [🗂️ Framework Examples](#️-framework-examples)
  - [⚛️ Next.js](/examples/nextjs-actorkit-todo/README.md)
  - [🎸 Remix](/examples/remix-actorkit-todo/README.md)
- [📖 API Reference](#-api-reference)
  - [🔧 actor-kit/worker](#🔧-actor-kit-worker)
  - [🖥️ actor-kit/server](#🖥️-actor-kit-server)
  - [🌐 actor-kit/browser](#🌐-actor-kit-browser)
  - [⚛️ actor-kit/react](#⚛️-actor-kit-react)
  - [🧪 actor-kit/test](#🧪-actor-kit-test)
  - [📚 actor-kit/storybook](#📚-actor-kit-storybook)
- [🔑 TypeScript Types](#-typescript-types)
- [👥 Caller Types](#-caller-types)
- [🔐 Public and Private Data](#-public-and-private-data)
- [🧪 Testing Utilities](#-testing-utilities)
- [📚 Storybook Integration](#-storybook-integration)
- [📜 License](#-license)
- [🔗 Related Technologies and Inspiration](#-related-technologies-and-inspiration)
- [🚧 Development Status](#-development-status)

## 💾 Installation

To install Actor Kit, use your preferred package manager:

```bash
npm install actor-kit xstate zod jose react
# or
yarn add actor-kit xstate zod jose react
# or
pnpm add actor-kit xstate zod jose react
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

## 🏗️ Architecture

```mermaid
graph TD
    subgraph "User Browser"
        A[Client Components<br>APIs: useSelector, useSend]
        B[Actor Kit Client<br>API: createActorKitClient]
    end

    subgraph "Cloudflare Worker"
        C[Actor Kit Router<br>API: createActorKitRouter]
        subgraph "Actor Server"
            D[Machine Server DO<br>API: createMachineServer]
            X[XState Machine]
            F[(Durable Object Storage)]
        end
    end

    subgraph "Server-Side Rendering"
        E[Next.js/Remix/etc<br>APIs: createActorFetch, createAccessToken]
    end

    G[External API]
    H[(Database)]
    I[Third-party Service<br>e.g., Authentication, Payment, Analytics]

    A -->|Events| B
    B <-->|Send Events / Recv Patches| C
    C -->|Route| D
    D <-->|Manage State| X
    X <-->|Read/Write| F
    X --> G
    X --> H
    X --> I
    E <-->|Fetch/Send Events| C
    E -->|Deliver HTML/JS| A
    E <--> H

    classDef browser fill:#f0f0f0,stroke:#333,stroke-width:2px;
    classDef worker fill:#ffe6e6,stroke:#333,stroke-width:2px;
    classDef actorserver fill:#ffcccc,stroke:#333,stroke-width:2px;
    classDef ssr fill:#ffe6ff,stroke:#333,stroke-width:2px;
    classDef storage fill:#e6e6ff,stroke:#333,stroke-width:2px;
    classDef external fill:#e6ffff,stroke:#333,stroke-width:2px;

    class A,B browser;
    class C worker;
    class D,X,F actorserver;
    class E ssr;
    class G,H,I external;
```

## 🛠️ Usage

Here's a comprehensive example of how to use Actor Kit to create a todo list application with Next.js and Cloudflare Workers:

### 1️⃣ Define your event schemas and types

First, define the schemas and types for your events:

```typescript
// src/todo.schemas.ts
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

export const TodoInputPropsSchema = z.object({
  accessCount: z.number(),
});

// src/todo.types.ts
import type {
  ActorKitSystemEvent,
  WithActorKitEvent,
  WithActorKitInput,
} from "actor-kit";
import { z } from "zod";
import {
  TodoClientEventSchema,
  TodoInputPropsSchema,
  TodoServiceEventSchema,
} from "./todo.schemas";

export type TodoClientEvent = z.infer<typeof TodoClientEventSchema>;
export type TodoServiceEvent = z.infer<typeof TodoServiceEventSchema>;
export type TodoInputProps = z.infer<typeof TodoInputPropsSchema>;
export type TodoInput = WithActorKitInput<TodoInputProps>;

export type TodoEvent =
  | WithActorKitEvent<TodoClientEvent, "client">
  | WithActorKitEvent<TodoServiceEvent, "service">
  | ActorKitSystemEvent;

export type TodoPublicContext = {
  ownerId: string;
  todos: Array<{ id: string; text: string; completed: boolean }>;
  lastSync: number | null;
};

export type TodoPrivateContext = {
  accessCount: number;
};

export type TodoServerContext = {
  public: TodoPublicContext;
  private: Record<string, TodoPrivateContext>;
};
```

### 2️⃣ Define your state machine

Now that we have our event types defined, we can create our state machine:

```typescript
// src/todo.machine.ts
import { ActorKitStateMachine } from "actor-kit";
import { assign, setup } from "xstate";
import type {
  TodoEvent,
  TodoInput,
  TodoPrivateContext,
  TodoPublicContext,
  TodoServerContext,
} from "./todo.types";

export const todoMachine = setup({
  types: {
    context: {} as TodoServerContext,
    events: {} as TodoEvent,
    input: {} as TodoInput,
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
}) satisfies ActorKitStateMachine<
  TodoEvent,
  TodoInput,
  TodoPrivateContext,
  TodoPublicContext
>;
```

### 3️⃣ Set up the Actor Server

Create the Actor Server using the `createMachineServer` function:

```typescript
// src/todo.server.ts
import { createMachineServer } from "actor-kit/worker";
import { todoMachine } from "./todo.machine";
import {
  TodoClientEventSchema,
  TodoServiceEventSchema,
  TodoInputPropsSchema,
} from "./todo.schemas";

export const Todo = createMachineServer({
  machine: todoMachine,
  schemas: {
    clientEvent: TodoClientEventSchema,
    serviceEvent: TodoServiceEventSchema,
    inputProps: TodoInputPropsSchema,
  },
  options: {
    persisted: true,
  },
});

export type TodoServer = InstanceType<typeof Todo>;
export default Todo;
```

### 4️⃣ Configure Wrangler

Create a `wrangler.toml` file in your project root:

```toml
name = "nextjs-actorkit-todo"
main = "src/server.ts"
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

Create a new file, e.g., `src/server.ts`, to set up your Cloudflare Worker:

```typescript
// src/server.ts
import { DurableObjectNamespace } from "@cloudflare/workers-types";
import { AnyActorServer } from "actor-kit";
import { createActorKitRouter } from "actor-kit/worker";
import { WorkerEntrypoint } from "cloudflare:workers";
import { Todo, TodoServer } from "./todo.server";

interface Env {
  TODO: DurableObjectNamespace<TodoServer>;
  ACTOR_KIT_SECRET: string;
  [key: string]: DurableObjectNamespace<AnyActorServer> | unknown;
}

const router = createActorKitRouter<Env>(["todo"]);

export { Todo };

export default class Worker extends WorkerEntrypoint<Env> {
  fetch(request: Request): Promise<Response> | Response {
    if (request.url.includes("/api/")) {
      return router(request, this.env, this.ctx);
    }

    return new Response("API powered by ActorKit");
  }
}
```

### 6️⃣ Create the Actor Kit Context

```typescript
// src/todo.context.tsx
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

   For development:
   Create a `.dev.vars` file in your project root:

   ```bash
   touch .dev.vars
   ```

   Add the following to `.dev.vars`:

   ```
   ACTOR_KIT_SECRET=your-secret-key
   ```

   Replace `your-secret-key` with a secure, randomly generated secret.

   For production:
   Set up the secret using Wrangler:

   ```bash
   npx wrangler secret put ACTOR_KIT_SECRET
   ```

   Enter the same secret key you used in your `.dev.vars` file.

3. Create a `wrangler.toml` file in your project root:

   ```toml
   name = "your-project-name"
   main = "src/server.ts"
   compatibility_date = "2024-09-25"

   [[durable_objects.bindings]]
   name = "YOUR_ACTOR"
   class_name = "YourActor"

   [[migrations]]
   tag = "v1"
   new_classes = ["YourActor"]
   ```

   Replace `your-project-name` with your project's name, and `YOUR_ACTOR` and `YourActor` with your specific actor names.

4. Create your Worker script (e.g., `src/server.ts`):

   ```typescript
   import { createActorKitRouter } from "actor-kit/worker";
   import { YourActor } from "./your-actor.server";

   const actorKitRouter = createActorKitRouter({
     yourActor: YourActor,
   });

   export default {
     async fetch(
       request: Request,
       env: Env,
       ctx: ExecutionContext
     ): Promise<Response> {
       const url = new URL(request.url);

       if (url.pathname.startsWith("/api/")) {
         return actorKitRouter(request, env, ctx);
       }

       return new Response("Server powered by ActorKit");
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

7. If you're using Next.js or another external server, set up your `ACTOR_KIT_HOST` environment variable to point to your deployed Worker's URL.

By following these steps, you'll have a basic Actor Kit setup running on Cloudflare Workers. For more detailed, framework-specific instructions, please refer to our example projects for [Next.js](/examples/nextjs-actorkit-todo/README.md) and [Remix](/examples/remix-actorkit-todo/README.md).

## 🗂️ Framework Examples

Actor Kit includes example todo list applications demonstrating integration with popular web frameworks.

- [Next.js example](/examples/nextjs-actorkit-todo/README.md) in `/examples/nextjs-actorkit-todo`

  - Live demo: [https://nextjs-actorkit-todo.vercel.app/](https://nextjs-actorkit-todo.vercel.app/)

- [Remix example](/examples/remix-actorkit-todo/README.md) in `/examples/remix-actorkit-todo`
  - Live demo: [https://remix-actorkit-todo.jonathanrmumm.workers.dev/](https://remix-actorkit-todo.jonathanrmumm.workers.dev/)

These examples showcase how to integrate Actor Kit with different frameworks, demonstrating real-time, event-driven todo lists with owner-based access control. Visit the live demos to see Actor Kit in action!

## 📖 API Reference

### 🔧 actor-kit/worker

#### `createMachineServer<TClientEvent, TServiceEvent, TInputSchema, TMachine, Env>(props)`

Creates a server instance of a state machine.

```typescript
function createMachineServer<
  TClientEvent extends AnyEventObject,
  TServiceEvent extends AnyEventObject,
  TInputSchema extends z.ZodObject<z.ZodRawShape>,
  TMachine extends ActorKitStateMachine<
    | WithActorKitEvent<TClientEvent, "client">
    | WithActorKitEvent<TServiceEvent, "service">
    | ActorKitSystemEvent,
    z.infer<TInputSchema> & { id: string; caller: Caller },
    any,
    any
  >,
  Env extends { ACTOR_KIT_SECRET: string }
>({
  machine,
  schemas,
  options,
}: {
  machine: TMachine;
  schemas: {
    clientEvent: z.ZodSchema<TClientEvent>;
    serviceEvent: z.ZodSchema<TServiceEvent>;
    inputProps: TInputSchema;
  };
  options?: MachineServerOptions;
}): new (
  state: DurableObjectState,
  env: Env,
  ctx: ExecutionContext
) => ActorServer<TMachine>
````


Example usage:

````typescript
import { createMachineServer } from "actor-kit/worker";
import { ActorKitStateMachine, WithActorKitEvent, WithActorKitInput, ActorKitSystemEvent } from "actor-kit";
import { assign, setup } from "xstate";
import { z } from "zod";

// Define schemas
const TodoClientEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("ADD_TODO"), text: z.string() }),
  z.object({ type: z.literal("TOGGLE_TODO"), id: z.string() }),
  z.object({ type: z.literal("DELETE_TODO"), id: z.string() }),
]);

const TodoServiceEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("SYNC_TODOS"),
    todos: z.array(z.object({ id: z.string(), text: z.string(), completed: z.boolean() })),
  }),
]);

const TodoInputPropsSchema = z.object({
  initialTodos: z.array(z.object({ id: z.string(), text: z.string(), completed: z.boolean() })).optional(),
});

// Infer types from schemas
type TodoClientEvent = z.infer<typeof TodoClientEventSchema>;
type TodoServiceEvent = z.infer<typeof TodoServiceEventSchema>;
type TodoInputProps = z.infer<typeof TodoInputPropsSchema>;

// Define combined event type
type TodoEvent =
  | WithActorKitEvent<TodoClientEvent, "client">
  | WithActorKitEvent<TodoServiceEvent, "service">
  | ActorKitSystemEvent;

type TodoInput = WithActorKitInput<TodoInputProps>;

type TodoPublicContext = {
  ownerId: string;
  todos: Array<{ id: string; text: string; completed: boolean }>;
  lastSync: number | null;
};

type TodoPrivateContext = {
  lastAccessTime: number;
};

type TodoContext = {
  public: TodoPublicContext;
  private: Record<string, TodoPrivateContext>;
};

// Define the machine
const todoMachine = setup({
  types: {} as {
    context: TodoContext;
    events: TodoEvent;
    input: TodoInput;
  },
  actions: {
    addTodo: assign({
      public: ({ context, event }) => ({
        ...context.public,
        todos: event.type === "ADD_TODO" 
          ? [...context.public.todos, { id: crypto.randomUUID(), text: event.text, completed: false }]
          : context.public.todos,
        lastSync: Date.now(),
      }),
    }),
    // ... other actions
  },
  guards: {
    isOwner: ({ context, event }) => event.caller.id === context.public.ownerId,
  },
}).createMachine({
  id: "todo",
  context: ({ input }) => ({
    public: {
      ownerId: input.caller.id,
      todos: input.initialTodos || [],
      lastSync: null,
    },
    private: {},
  }),
  on: {
    ADD_TODO: { actions: ["addTodo"], guard: "isOwner" },
    // ... other event handlers
  },
}) satisfies ActorKitStateMachine<TodoEvent, TodoInput, TodoPrivateContext, TodoPublicContext>;

// Create the machine server
const Todo = createMachineServer({
  machine: todoMachine,
  schemas: {
    clientEvent: TodoClientEventSchema,
    serviceEvent: TodoServiceEventSchema,
    inputProps: TodoInputPropsSchema,
  },
  options: { persisted: true },
});

export type TodoServer = InstanceType<typeof Todo>;
export default Todo;
````

#### `createActorKitRouter<Env>(routes)`

Creates a router for handling Actor Kit requests in a Cloudflare Worker.

- `Env: Type parameter extending `EnvWithDurableObjects`
- `routes`: An array of actor types (as kebab-case strings)

Returns a function `(request: Request, env: Env, ctx: ExecutionContext) => Promise<Response>` that handles Actor Kit routing.

Example usage:

`````typescript
import { createActorKitRouter } from "actor-kit/worker";

const actorKitRouter = createActorKitRouter(["todo", "chat"]);

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    return actorKitRouter(request, env, ctx);
  },
};
`````

### 🖥️ `actor-kit/server`

#### `createActorFetch<TMachine>({ actorType, host })`

Creates a function for fetching actor data. Used in a trusted server environment, typically for server-side rendering or initial data fetching.

- `TMachine`: Type parameter extending `ActorKitStateMachine`
- `actorType`: String identifier for the actor type
- `host`: The host URL for the Actor Kit server

Returns a function with the following signature:

```typescript
(
  props: {
    actorId: string;
    accessToken: string;
    input?: Record<string, unknown>;
    waitFor?: string;
  },
  options?: RequestInit
) =>
  Promise<{
    snapshot: CallerSnapshotFrom<TMachine>;
    checksum: string;
  }>;
```

Example usage:

```typescript
import { createActorFetch } from "actor-kit/server";
import type { TodoMachine } from "./todo.machine";

const fetchTodoActor = createActorFetch<TodoMachine>({
  actorType: "todo",
  host: "your-worker.workers.dev",
});

const { snapshot, checksum } = await fetchTodoActor({
  actorId: "todo-123",
  accessToken: "your-access-token",
  waitFor: "TODOS_LOADED",
});
```

#### `createAccessToken({ signingKey, actorId, actorType, callerId, callerType })`

Creates an access token for authenticating with an actor.

Parameters:

- `signingKey`: String used to sign the token
- `actorId`: Unique identifier for the actor
- `actorType`: Type of the actor
- `callerId`: Identifier for the caller
- `callerType`: Type of the caller (e.g., 'client', 'service')

Returns a Promise that resolves to a JWT token string.

Example usage:

```typescript
import { createAccessToken } from "actor-kit/server";

const accessToken = await createAccessToken({
  signingKey: process.env.ACTOR_KIT_SECRET!,
  actorId: "todo-123",
  actorType: "todo",
  callerId: "user-456",
  callerType: "client",
});
```

### 🌐 `actor-kit/browser`

#### `createActorKitClient<TMachine>(props: ActorKitClientProps<TMachine>)`

Creates an Actor Kit client for managing state and communication with the server.

- `TMachine`: Type parameter extending `ActorKitStateMachine`

`ActorKitClientProps<TMachine>` includes:

- `host`: String
- `actorType`: String
- `actorId`: String
- `checksum`: String
- `accessToken`: String
- `initialSnapshot`: `CallerSnapshotFrom<TMachine>`

Returns an `ActorKitClient<TMachine>` object with methods to interact with the actor.

Example usage:

```typescript
import { createActorKitClient } from "actor-kit/browser";
import type { TodoMachine } from "./todo.machine";

const client = createActorKitClient<TodoMachine>({
  host: "your-worker.workers.dev",
  actorType: "todo",
  actorId: "todo-123",
  checksum: "initial-checksum",
  accessToken: "your-access-token",
  initialSnapshot: {
    public: { todos: [] },
    private: {},
    value: "idle",
  },
});

await client.connect();
client.send({ type: "ADD_TODO", text: "Buy milk" });
```

#### `ActorKitClient` Methods

- **`connect()`**: Establishes connection to the actor server
- **`disconnect()`**: Closes the connection to the actor server
- **`send(event)`**: Sends an event to the actor
- **`getState()`**: Returns the current state snapshot
- **`subscribe(listener)`**: Registers a listener for state changes
- **`waitFor(predicateFn, timeoutMs?)`**: Waits for a state condition to be met

##### Using `waitFor`

The `waitFor` method allows you to wait for specific state conditions:

```typescript
import { createActorKitClient } from 'actor-kit/browser';

const client = createActorKitClient<TodoMachine>({
  // ... client config
});

// Wait for a specific state value
await client.waitFor(state => state.value === 'ready');

// Wait for a condition with custom timeout
await client.waitFor(
  state => state.public.todos.length > 0,
  10000 // 10 seconds
);

// Wait for complex conditions
await client.waitFor(state => 
  state.public.todos.some(todo => todo.text === 'Buy milk' && todo.completed)
);
```

### ⚛️ `actor-kit/react`

#### `createActorKitContext<TMachine>(actorType: string)`

Creates a React context and associated hooks and components for integrating Actor Kit into a React application.

- `TMachine`: Type parameter extending `ActorKitStateMachine`
- `actorType`: String identifier for the actor type

Returns an object with:

- `Provider`: React component to provide the Actor Kit client to its children
- `useClient()`: Hook to access the Actor Kit client directly
- `useSelector<T>(selector: (snapshot: CallerSnapshotFrom<TMachine>) => T)`: Hook to select and subscribe to specific parts of the state
- `useSend()`: Hook to get a function for sending events to the Actor Kit client
- `useMatches(stateValue: StateValueFrom<TMachine>)`: Hook to check if the current state matches a given state value
- `Matches`: Component for conditionally rendering based on state matches

Example usage:

```tsx
import { createActorKitContext } from "actor-kit/react";
import type { TodoMachine } from "./todo.machine";

const TodoActorKitContext = createActorKitContext<TodoMachine>("todo");

function App() {
  return (
    <TodoActorKitContext.Provider
      host="your-worker.workers.dev"
      actorId="todo-123"
      accessToken="your-access-token"
      checksum="initial-checksum"
      initialSnapshot={{
        public: { todos: [] },
        private: {},
        value: "idle",
      }}
    >
      <TodoList />
    </TodoActorKitContext.Provider>
  );
}

function TodoList() {
  const todos = TodoActorKitContext.useSelector((state) => state.public.todos);
  const send = TodoActorKitContext.useSend();
  const isIdle = TodoActorKitContext.useMatches("idle");

  return (
    <div>
      {isIdle && <p>The todo list is idle</p>}
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
    </div>
  );
}
```

#### `useClient()`

Hook to access the Actor Kit client directly.

Example usage:

```tsx
function TodoActions() {
  const client = TodoActorKitContext.useClient();

  const handleClearCompleted = () => {
    client.send({ type: "CLEAR_COMPLETED" });
  };

  return <button onClick={handleClearCompleted}>Clear Completed</button>;
}
```

#### `useSelector<T>(selector: (snapshot: CallerSnapshotFrom<TMachine>) => T)`

Hook to select and subscribe to specific parts of the state.

Example usage:

```tsx
function CompletedTodosCount() {
  const completedCount = TodoActorKitContext.useSelector(
    (state) => state.public.todos.filter((todo) => todo.completed).length
  );

  return <span>Completed todos: {completedCount}</span>;
}
```

#### `useSend()`

Hook to get a function for sending events to the Actor Kit client.

Example usage:

```tsx
function AddTodoForm() {
  const [text, setText] = useState("");
  const send = TodoActorKitContext.useSend();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim()) {
      send({ type: "ADD_TODO", text: text.trim() });
      setText("");
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Add a new todo"
      />
      <button type="submit">Add</button>
    </form>
  );
}
```

#### `useMatches(stateValue: StateValueFrom<TMachine>)`

Hook to check if the current state matches a given state value.

Example usage:

```tsx
function LoadingIndicator() {
  const isLoading = TodoActorKitContext.useMatches("loading");

  return isLoading ? <div>Loading...</div> : null;
}
```

#### `Matches` Component

The `Matches` component allows for conditional rendering based on the current state of the actor machine.

Props:

- `state: StateValueFrom<TMachine>`: The state value to match against
- `and?: StateValueFrom<TMachine>`: Optional additional state to match (AND condition)
- `or?: StateValueFrom<TMachine>`: Optional alternative state to match (OR condition)
- `not?: boolean`: Invert the match result if true
- `children: ReactNode`: Content to render when the condition is met
- `initialValueOverride?: boolean`: Optional override for the initial render value

Example usage:

````tsx
function TodoList() {
  const todos = TodoActorKitContext.useSelector((state) => state.public.todos);
  const send = TodoActorKitContext.useSend();

  return (
    <div>
      <TodoActorKitContext.Matches state="idle">
        <p>The todo list is idle</p>
      </TodoActorKitContext.Matches>
      <TodoActorKitContext.Matches state="loading">
        <p>Loading todos...</p>
      </TodoActorKitContext.Matches>
      <TodoActorKitContext.Matches state="error" not>
        <ul>
          {todos.map((todo) => (
            <li key={todo.id}>
              {todo.text}
              <button
                onClick={() => send({ type: "TOGGLE_TODO", id: todo.id })}
              >
                Toggle
              </button>
            </li>
          ))}
        </ul>
      </TodoActorKitContext.Matches>
    </div>
  );
}
````

You can also use the `Matches` component with more complex conditions:

````tsx
function TodoList() {
  const todos = TodoActorKitContext.useSelector((state) => state.public.todos);
  const send = TodoActorKitContext.useSend();

  return (
    <div>
      <TodoActorKitContext.Matches state="idle" or="ready">
        <p>The todo list is ready for action</p>
      </TodoActorKitContext.Matches>
      <TodoActorKitContext.Matches state="loading" and={{ data: "fetching" }}>
        <p>Fetching todos from the server...</p>
      </TodoActorKitContext.Matches>
      <TodoActorKitContext.Matches state="error" not>
        <ul>
          {todos.map((todo) => (
            <li key={todo.id}>
              {todo.text}
              <button
                onClick={() => send({ type: "TOGGLE_TODO", id: todo.id })}
              >
                Toggle
              </button>
            </li>
          ))}
        </ul>
      </TodoActorKitContext.Matches>
    </div>
  );
}
````

### 🧪 actor-kit/test

#### `createActorKitMockClient<TMachine>(props: ActorKitMockClientProps<TMachine>)`

Creates a mock client for testing Actor Kit state machines without needing a live server.

Parameters:
- `initialSnapshot`: Initial state snapshot for the mock client
- `onSend?`: Optional callback function invoked whenever an event is sent

Returns a mock client that implements the standard `ActorKitClient` interface plus additional testing utilities:
- All standard client methods (send, subscribe, etc.)
- `produce(recipe: (draft: Draft<CallerSnapshotFrom<TMachine>>) => void)`: Method for directly manipulating state using Immer

Example usage:

````typescript
import { createActorKitMockClient } from 'actor-kit/test';
import type { TodoMachine } from './todo.machine';

describe('Todo State Management', () => {
  it('should handle state transitions', () => {
    const mockClient = createActorKitMockClient<TodoMachine>({
      initialSnapshot: {
        public: { 
          todos: [],
          status: 'idle'
        },
        private: {},
        value: 'idle'
      }
    });

    // Use Immer's produce to update state
    mockClient.produce((draft) => {
      draft.public.todos.push({
        id: '1',
        text: 'Test todo',
        completed: false
      });
    });

    expect(mockClient.getState().public.todos).toHaveLength(1);
  });

  it('should track sent events', () => {
    const sendSpy = vi.fn();
    const mockClient = createActorKitMockClient<TodoMachine>({
      initialSnapshot: { /* ... */ },
      onSend: sendSpy
    });

    mockClient.send({ type: 'ADD_TODO', text: 'Test todo' });
    expect(sendSpy).toHaveBeenCalledWith({
      type: 'ADD_TODO',
      text: 'Test todo'
    });
  });
});
````

### 📚 actor-kit/storybook

#### `withActorKit<TMachine>({ actorType, context })`

Creates a Storybook decorator for testing components that depend on Actor Kit state.

Parameters:
- `actorType`: String identifier for the actor type
- `context`: The Actor Kit context created by `createActorKitContext`

Returns a Storybook decorator function.

Example usage:

````typescript
import { withActorKit } from 'actor-kit/storybook';
import { GameContext } from './game.context';
import type { GameMachine } from './game.machine';

const meta = {
  title: 'Components/GameView',
  component: GameView,
  decorators: [
    withActorKit<GameMachine>({
      actorType: "game",
      context: GameContext,
    }),
  ],
};
````

#### `StoryWithActorKit<TMachine>`

A utility type for stories that use Actor Kit state machines. It combines the standard Storybook story type with Actor Kit parameters.

Example usage:

````typescript
import type { StoryWithActorKit } from 'actor-kit/storybook';
import type { GameMachine } from './game.machine';

export const GameStory: StoryWithActorKit<GameMachine> = {
  parameters: {
    actorKit: {
      game: {
        "game-123": {
          public: { /* initial state */ },
          private: {},
          value: "idle"
        }
      }
    }
  }
}
````


### System Events

Actor Kit includes several system events that are automatically handled by the state machine. These events are of type `ActorKitSystemEvent` and include:

- `INITIALIZE`: Fired when an actor is first created.
- `CONNECT`: Fired when a client connects to the actor.
- `DISCONNECT`: Fired when a client disconnects from the actor.
- `RESUME`: Fired when an actor is resumed.
- `MIGRATE`: Fired when an actor needs to migrate its state, including an operations array.

The `ActorKitSystemEvent` type is defined as follows:

```typescript
export type ActorKitSystemEvent =
  | { type: "INITIALIZE"; caller: { type: "system" id: string } }
  | { type: "CONNECT"; caller: { type: "system"; id: string }; clientId: string }
  | { type: "DISCONNECT"; caller: { type: "system"; id: string }; clientId: string }
  | { type: "RESUME"; caller: { type: "system"; id: string } }
  | { type: "MIGRATE"; caller: { type: "system"; id: string }; operations: any[] };
```

These events can be handled in your state machine definition:

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
        RESUME: {
          actions: "handleActorResume",
        },
        MIGRATE: {
          actions: "handleActorMigration",
        },
        // ... other transitions ...
      },
    },
    // ... other states ...
  },
});
```

### 🧪 Testing with Mock Client

#### `createActorKitMockClient<TMachine>`

Creates a mock client for testing Actor Kit state machines without needing a live server. It implements the standard `ActorKitClient` interface plus additional testing utilities.

**Type Parameters:**
- `TMachine`: The type of the state machine, extending `AnyActorKitStateMachine`

**Parameters:**
- `props: ActorKitMockClientProps<TMachine>`: Configuration options including:
  - `initialSnapshot`: The initial state snapshot
  - `onSend?`: Optional callback function invoked whenever an event is sent

**Returns:**
An `ActorKitMockClient<TMachine>` with all standard client methods plus:
- `produce(recipe: (draft: Draft<CallerSnapshotFrom<TMachine>>) => void)`: Method for directly manipulating state using Immer

**Basic Example:**

```typescript
import { createActorKitMockClient } from 'actor-kit/test';
import type { TodoMachine } from './todo.machine';

describe('Todo State Management', () => {
  it('should handle state transitions', () => {
    const mockClient = createActorKitMockClient<TodoMachine>({
      initialSnapshot: {
        public: { 
          todos: [],
          status: 'idle'
        },
        private: {},
        value: 'idle'
      }
    });

    // Use Immer's produce to update state
    mockClient.produce((draft) => {
      draft.public.todos.push({
        id: '1',
        text: 'Test todo',
        completed: false
      });
      draft.value = 'ready';
    });

    // Verify state changes
    expect(mockClient.getState().public.todos).toHaveLength(1);
    expect(mockClient.getState().value).toBe('ready');
  });
});
```

**Spying on Events:**

```typescript
import { vi } from 'vitest'; // or jest

describe('Todo Event Handling', () => {
  it('should track sent events', () => {
    const sendSpy = vi.fn();
    const mockClient = createActorKitMockClient<TodoMachine>({
      initialSnapshot: {
        public: { 
          todos: [],
          status: 'idle'
        },
        private: {},
        value: 'idle'
      },
      onSend: sendSpy
    });

    // Send an event
    mockClient.send({ type: 'ADD_TODO', text: 'Test todo' });

    // Verify the event was sent
    expect(sendSpy).toHaveBeenCalledWith({
      type: 'ADD_TODO',
      text: 'Test todo'
    });

    // Check call count
    expect(sendSpy).toHaveBeenCalledTimes(1);

    // Verify specific event properties
    const [sentEvent] = sendSpy.mock.calls[0];
    expect(sentEvent.type).toBe('ADD_TODO');
    expect(sentEvent.text).toBe('Test todo');
  });

  it('should track multiple events in order', () => {
    const sendSpy = vi.fn();
    const mockClient = createActorKitMockClient<TodoMachine>({
      initialSnapshot: {
        public: { 
          todos: [{ id: '1', text: 'Test todo', completed: false }],
          status: 'idle'
        },
        private: {},
        value: 'idle'
      },
      onSend: sendSpy
    });

    // Send multiple events
    mockClient.send({ type: 'TOGGLE_TODO', id: '1' });
    mockClient.send({ type: 'DELETE_TODO', id: '1' });

    // Verify events were sent in order
    expect(sendSpy.mock.calls).toEqual([
      [{ type: 'TOGGLE_TODO', id: '1' }],
      [{ type: 'DELETE_TODO', id: '1' }]
    ]);
  });
});
```

**Testing React Components:**

```typescript
import { render, screen } from '@testing-library/react';
import { TodoActorKitContext } from './todo.context';
import { createActorKitMockClient } from 'actor-kit/test';

describe('TodoList', () => {
  it('renders todos correctly', () => {
    const mockClient = createActorKitMockClient<TodoMachine>({
      initialSnapshot: {
        public: { 
          todos: [],
          status: 'idle'
        },
        private: {},
        value: 'idle'
      }
    });

    render(
      <TodoActorKitContext.ProviderFromClient client={mockClient}>
        <TodoList />
      </TodoActorKitContext.ProviderFromClient>
    );

    // Update state using Immer
    mockClient.produce((draft) => {
      draft.public.todos.push({
        id: '1',
        text: 'Test todo',
        completed: false
      });
    });

    // Verify UI updates
    expect(screen.getByText('Test todo')).toBeInTheDocument();
  });
});
```

The mock client provides two powerful testing capabilities:

1. **State Manipulation**: The `produce` method uses Immer to allow intuitive, mutable-style updates to the immutable state. This makes it easy to set up different test scenarios.

2. **Event Tracking**: The `onSend` callback can be used with testing framework spies to verify that components are sending the correct events at the right times.

These features make it simple to test both state transitions and component behavior without needing a real server connection.

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

#### `ActorKitStateMachine`

Represents the structure of an Actor Kit state machine.

```typescript
type ActorKitStateMachine<
  TEvent extends BaseActorKitEvent & EventObject,
  TInput extends { id: string; caller: Caller },
  TPrivateProps extends { [key: string]: unknown },
  TPublicProps extends { [key: string]: unknown }
> = StateMachine<...>
```

Example usage:

```typescript
import { ActorKitStateMachine } from "actor-kit";
import { setup } from "xstate";
import type {
  TodoEvent,
  TodoInput,
  TodoPrivateContext,
  TodoPublicContext,
} from "./todo.types";

export const todoMachine = setup({
  // ... machine setup
}).createMachine({
  // ... machine definition
}) satisfies ActorKitStateMachine<
  TodoEvent,
  TodoInput,
  TodoPrivateContext,
  TodoPublicContext
>;
```

### Other Types

- `ClientEventFrom<TMachine extends AnyActorKitStateMachine>`: Utility type to extract client events from an Actor Kit state machine.
- `ServiceEventFrom<TMachine extends AnyActorKitStateMachine>`: Utility type to extract service events from an Actor Kit state machine.

By including these types in your Actor Kit implementation, you ensure type safety and proper handling of events and state across your application.

## 🔐 Public and Private Data

Actor Kit supports the concepts of public and private data in the context. This allows you to manage shared data across all clients and caller-specific information securely.

## 📚 Storybook Integration

Actor Kit provides seamless integration with Storybook through the `withActorKit` decorator, allowing you to easily test and develop components that depend on actor state.

### Basic Usage

```typescript
import { withActorKit } from 'actor-kit/storybook';
import { GameContext } from './game.context';
import type { GameMachine } from './game.machine';

const meta = {
  title: 'Components/GameView',
  component: GameView,
  decorators: [
    withActorKit<GameMachine>({
      actorType: "game",
      context: GameContext,
    }),
  ],
};

export default meta;
type Story = StoryObj<typeof GameView>;

export const Default: Story = {
  parameters: {
    actorKit: {
      game: {
        "game-123": {
          public: {
            players: [],
            gameStatus: "idle"
          },
          private: {},
          value: "idle"
        }
      }
    }
  }
};
```

### Testing Patterns

There are two main patterns for testing with Actor Kit in Storybook:

#### 1. Static Stories (Using parameters.actorKit)

Best for simple stories that don't need state manipulation:

```typescript
export const Static: Story = {
  parameters: {
    actorKit: {
      game: {
        "game-123": {
          public: { /* initial state */ },
          private: {},
          value: "idle"
        }
      }
    }
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Test UI state...
  }
};
```

#### 2. Interactive Stories (Using mount + direct client)

Better for stories that need to manipulate state:

```typescript
export const Interactive: Story = {
  play: async ({ canvasElement, mount }) => {
    const client = createActorKitMockClient<GameMachine>({
      initialSnapshot: {
        public: { /* initial state */ },
        private: {},
        value: "idle"
      }
    });

    await mount(
      <GameContext.ProviderFromClient client={client}>
        <GameView />
      </GameContext.ProviderFromClient>
    );

    // Now you can manipulate state
    client.produce((draft) => {
      draft.public.players.push({
        id: "player-1",
        name: "Player 1"
      });
    });
  }
};
```

### Multiple Actors

You can use multiple actors in a single story:

```typescript
const meta = {
  decorators: [
    withActorKit<SessionMachine>({
      actorType: "session",
      context: SessionContext,
    }),
    withActorKit<GameMachine>({
      actorType: "game",
      context: GameContext,
    }),
  ],
};

export const MultipleActors: Story = {
  parameters: {
    actorKit: {
      session: {
        "session-123": {
          public: { /* session state */ },
          private: {},
          value: "ready"
        }
      },
      game: {
        "game-123": {
          public: { /* game state */ },
          private: {},
          value: "active"
        }
      }
    }
  }
};
```

### Step-by-Step Testing

Use the `step` function to organize your tests:

```typescript
export const GameFlow: Story = {
  play: async ({ canvas, mount, step }) => {
    await step('Mount component with initial state', async () => {
      await mount(<GameView />);
    });

    await step('Verify initial elements', async () => {
      const title = await canvas.findByText(/game lobby/i);
      expect(title).toBeInTheDocument();
    });

    await step('Simulate player joining', async () => {
      const client = createActorKitMockClient<GameMachine>({/*...*/});
      client.produce((draft) => {
        draft.public.players.push({
          id: "player-1",
          name: "Player 1"
        });
      });

      const playerName = await canvas.findByText("Player 1");
      expect(playerName).toBeInTheDocument();
    });
  }
};
```

The Storybook integration makes it easy to:
- Test components in different states
- Verify UI updates in response to state changes
- Test complex interactions and state transitions
- Document component behavior with interactive examples

## 📜 License

Actor Kit is [MIT licensed](LICENSE.md).

## 🔗 Related Technologies and Inspiration

Actor Kit builds upon and draws inspiration from several excellent technologies:

- [XState](https://xstate.js.org/): A powerful state management library for JavaScript and TypeScript applications.
- [Cloudflare Workers](https://workers.cloudflare.com/): A serverless platform for building and deploying applications at the edge.
- [Zod](https://zod.dev/): A TypeScript-first schema declaration and validation library.
- [PartyKit](https://www.partykit.io/): An inspiration for Actor Kit, providing real-time multiplayer infrastructure.
- [PartyServer](https://github.com/threepointone/partyserver/tree/main): PartyKit, for workers
- [xstate-migrate](https://github.com/jonmumm/xstate-migrate): A migration library for persisted XState machines, designed to facilitate state machine migrations when updating your XState configurations.

## 🚧 Development Status

Actor Kit is currently in active development and is considered alpha software. It is not yet stable or recommended for production use. Use at your own risk and expect frequent changes.
