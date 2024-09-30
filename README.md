# 🎭 Actor Kit

Actor Kit is a powerful library for creating and managing actor-based state machines in Cloudflare Workers, leveraging XState for robust state management. It provides a comprehensive framework for handling different types of events from various sources and manages the lifecycle of actors in a distributed environment.

For a practical implementation, check out our [Next.js Todo List Example](/examples/nextjs-todo) which demonstrates how to integrate Actor Kit with a Next.js application to create a real-time, event-driven todo list.

## 🚀 Installation

To install Actor Kit, use your preferred package manager:

```bash
npm install actor-kit xstate zod partykit
# or
yarn add actor-kit xstate zod partykit
# or
pnpm add actor-kit xstate zod partykit
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

### 4. Create the Actor Kit Context

```typescript
// src/app/lists/[id]/context.tsx
"use client";

import { TodoMachine } from "@/server/todo.actor";
import { createActorKitContext } from "actor-kit/react";

export const TodoActorKitContext = createActorKitContext<TodoMachine>("todo");
export const TodoActorKitProvider = TodoActorKitContext.Provider;
```

### 5. Fetch data server-side

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
        host: process.env.ACTOR_KIT_HOST!,
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

### 6. Create a client-side component

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
   npm install actor-kit xstate zod partykit
   ```

2. Set up environment variables:

   - `ACTOR_KIT_HOST`: The host for your Actor Kit server
   - `ACTOR_KIT_SECRET`: Secret key for Actor Kit

3. Create a PartyKit configuration file (`partykit.json`) in your project root:

   ```json
   {
     "$schema": "https://www.partykit.io/schema.json",
     "name": "your-project-name",
     "main": "build/index.js",
     "compatibilityDate": "2023-12-22",
     "parties": {
       "todo": "src/server/todo.server.ts"
     },
     "serve": "public"
   }
   ```

   This configuration tells PartyKit where to find your actor server file and sets up the necessary routing.

4. Start the PartyKit development server:

   ```bash
   npx partykit dev
   ```

5. In a separate terminal, run your Next.js development server:
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

Returns an `ActorServer` class implementing the `Party.Server` interface.

### `actor-kit/server`

#### `createActorFetch<TMachine>(actorType)`

Creates a function for fetching actor data. Used in a trusted server environment.

- `TMachine`: Type parameter representing the state machine type.
- `actorType`: String identifier for the actor type.

Returns a function `(props: object) => Promise<{ snapshot: CallerSnapshot, connectionId: string, connectionToken: string }>` that fetches a snapshot of the actor data.

### `actor-kit/react`

#### `createActorKitContext<TMachine>(actorType)`

Creates a React context for Actor Kit integration.

- `TMachine`: Type parameter representing the state machine type.
- `actorType`: String identifier for the actor type.

Returns an object with:

- `Provider`: React component to provide the Actor Kit client.
- `useClient()`: Hook to access the Actor Kit client directly.
- `useSelector(selector)`: Hook to select and subscribe to state only when it changes.
- `useSend()`: Hook to get a function for sending events to the Actor Kit client.

### `actor-kit/browser`

#### `createActorKitClient<TMachine>(props)`

Creates an Actor Kit client for managing state and communication with the server.

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