# 🎭 Actor Kit

Actor Kit is a powerful library for creating and managing actor-based state machines in Cloudflare Workers, leveraging XState for robust state management. It provides a comprehensive framework for handling different types of events from various sources and manages the lifecycle of actors in a distributed environment.

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

Here's a basic example of how to use Actor Kit to create a todo list application with Next.js, fetching data server-side:

### 1. Define your state machine

```typescript
// src/server/todo.actor.ts
import type { CreateMachineProps } from "actor-kit";
import { assign, setup } from "xstate";

export const createTodoListMachine = ({ id }: CreateMachineProps) =>
  setup({
    types: {
      context: {} as {
        public: {
          todos: Array<{ id: string; text: string; completed: boolean }>;
          lastSync: number | null;
        };
        private: Record<string, { lastAccessTime?: Date }>;
      },
      events: {} as
        | { type: "ADD_TODO"; text: string }
        | { type: "TOGGLE_TODO"; id: string }
        | { type: "DELETE_TODO"; id: string },
    },
    actions: {
      addTodo: assign({
        public: ({ context, event }) => ({
          ...context.public,
          todos: [
            ...context.public.todos,
            { id: crypto.randomUUID(), text: event.text, completed: false },
          ],
          lastSync: Date.now(),
        }),
      }),
      // ... other actions
    },
  }).createMachine({
    id,
    initial: "idle",
    states: {
      idle: {
        on: {
          ADD_TODO: { actions: "addTodo" },
          // ... other transitions
        },
      },
    },
  });

export type TodoMachine = ReturnType<typeof createTodoListMachine>;
```

### 2. Set up the Actor Server

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

### 3. Fetch data server-side

```typescript
// app/lists/[id]/page.tsx
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

### 4. Create a client-side component

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
            <span style={{ textDecoration: todo.completed ? "line-through" : "none" }}>
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

## 🔑 Types

The following types are exported from the main `actor-kit` package:

### `WithActorKitEvent<TEvent, TCallerType>`

Utility type that wraps an event type with Actor Kit-specific properties.

### `CallerSnapshotFrom<TMachine>`

Utility type to extract the caller-specific snapshot from a machine type.

### `ActorKitStateMachine`

Type definition for an Actor Kit state machine, extending XState's `StateMachine` type.

## 🔒 Public and Private Data

Actor Kit supports the concepts of public and private data in the context. This allows you to manage shared data across all clients and caller-specific information securely.

## 👥 Caller Types

Actor Kit supports different types of callers, each with its own level of trust and permissions:

- 👤 `client`: Events from end-users or client applications
- 🤖 `system`: Internal events generated by the actor system (handled internally)
- 🔧 `service`: Events from trusted external services or internal microservices

## 📖 Documentation

For more detailed documentation, including advanced usage, best practices, and API details, visit our [official documentation](https://docs.actor-kit.dev).

## 🤝 Contributing

We welcome contributions! Please see our [contributing guide](CONTRIBUTING.md) for more details.

## 📄 License

Actor Kit is [MIT licensed](LICENSE).