# Next.js + Actor Kit Todo Example

This project demonstrates how to integrate Actor Kit with a Next.js application to create a real-time, event-driven todo list with owner-based access control.

## 🌟 Key Features

- 🔄 Real-time synchronization across clients
- 🖥️ Server-side rendering with Next.js
- 🎭 State management using XState and Actor Kit
- 🛡️ Type-safe interactions with TypeScript and Zod
- 🔐 Secure handling of public and private data
- 🔒 JWT-based authentication middleware
- 👤 Owner-based access control demonstration

## 📁 Project Structure

```
examples/
├── shared/                      # Shared Actor Kit setup
│   ├── todo.context.tsx         # React context for Actor Kit
│   ├── todo.machine.ts          # State machine definition
│   ├── todo.schemas.ts          # Zod schemas for event validation
│   ├── todo.server.ts           # Actor Kit server setup
│   └── todo.types.ts            # TypeScript types for events and state
└── nextjs-actorkit-todo/
    ├── src/
    │   ├── app/
    │   │   ├── lists/
    │   │   │   └── [id]/
    │   │   │       ├── components.tsx  # Client-side todo list component
    │   │   │       └── page.tsx        # Server-side rendering and data fetching
    │   │   └── page.tsx                # Home page with "New List" button
    │   ├── server/
    │   │   └── main.ts          # Cloudflare Worker setup with Actor Kit router
    │   ├── middleware.ts        # Next.js middleware for authentication
    │   └── session.ts           # Utility for getting user ID
    ├── package.json             # Project dependencies and scripts
    ├── wrangler.toml            # Cloudflare Workers configuration
    └── README.md                # Project documentation
```

## 🛠️ How It Works

### 1. Shared Actor Kit Setup

The `shared` directory contains the core Actor Kit setup, including the state machine definition with access control logic.

### 2. Server-Side Integration

The todo list page (`src/app/lists/[id]/page.tsx`) fetches initial state and sets up the Actor Kit context:

```typescript
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

### 3. Client-Side Component with Access Control

The `TodoList` component (`src/app/lists/[id]/components.tsx`) demonstrates owner-based access control:

```typescript
"use client";

import { UserContext } from "@/app/user-context";
import React, { useContext, useState } from "react";
import { TodoActorKitContext } from "./todo.context";

export function TodoList() {
  const todos = TodoActorKitContext.useSelector((state) => state.public.todos);
  const send = TodoActorKitContext.useSend();
  const [newTodoText, setNewTodoText] = useState("");

  const userId = useContext(UserContext);
  const ownerId = TodoActorKitContext.useSelector(
    (state) => state.public.ownerId
  );
  const isOwner = ownerId === userId;

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
      {isOwner && (
        <form onSubmit={handleAddTodo}>
          <input
            type="text"
            value={newTodoText}
            onChange={(e) => setNewTodoText(e.target.value)}
            placeholder="Add a new todo"
          />
          <button type="submit">Add</button>
        </form>
      )}
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

Note how the component checks if the current user is the owner before rendering the add todo form:

```typescript
const isOwner = ownerId === userId;

// ...

{isOwner && (
  <form onSubmit={handleAddTodo}>
    {/* Add todo form */}
  </form>
)}
```

This ensures that only the owner of the todo list can add new items.

### 4. Cloudflare Worker Setup

The `src/server/main.ts` file sets up the Cloudflare Worker with Actor Kit:

```typescript
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

## 🚀 Getting Started

1. Clone the repository and navigate to the example directory:

   ```bash
   git clone https://github.com/jonmumm/actor-kit.git
   cd actor-kit/examples/nextjs-actorkit-todo
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Set up environment variables:
   Create a `.env.local` file with:

   ```
   ACTOR_KIT_HOST=http://localhost:8787
   ACTOR_KIT_SECRET=your-secret-key
   ```

   or

   ```bash
   cp .env.local.example .env.local
   ```

4. Start the Cloudflare Worker development server:

   ```bash
   npm run dev-server
   ```

5. In a separate terminal, run the Next.js development server:

   ```bash
   npm run dev
   ```

6. Open `http://localhost:3000` in your browser and start managing your todos!