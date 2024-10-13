# Remix + Actor Kit Todo Example

This project demonstrates how to integrate Actor Kit with a Remix application running entirely on Cloudflare Workers. It showcases a real-time, event-driven todo list with owner-based access control and session management, all within a single Worker.

Try it live: [https://remix-actorkit-todo.jonathanrmumm.workers.dev/](https://remix-actorkit-todo.jonathanrmumm.workers.dev/)

## 🌟 Key Features

- 🚀 Single Cloudflare Worker for both Remix app and Actor Kit backend
- 🔄 Real-time synchronization across clients
- 🖥️ Server-side rendering with Remix
- 🎭 State management using Actor Kit
- 🛡️ Type-safe interactions with TypeScript and Zod
- 🔐 Secure handling of public and private data
- 🔒 JWT-based authentication
- 👤 Owner-based access control demonstration
- 📝 Session management for tracking user's todo lists

## 📁 Project Structure

```
examples/remix-actorkit-todo/
├── app/
│   ├── routes/
│   │   ├── _index.tsx           # Home page
│   │   └── lists.$id.tsx        # Todo list page
│   ├── entry.client.tsx         # Client entry point
│   ├── entry.server.tsx         # Server entry point
│   ├── root.tsx                 # Root component
│   ├── todo.components.tsx      # Todo list components
│   ├── todo.context.tsx         # Actor Kit context for todos
│   ├── todo.machine.ts          # Todo state machine
│   ├── todo.schemas.ts          # Zod schemas for todo events
│   ├── todo.server.ts           # Todo server setup
│   ├── todo.types.ts            # TypeScript types for todos
│   ├── session.context.tsx      # Actor Kit context for session
│   ├── session.machine.ts       # Session state machine
│   ├── session.schemas.ts       # Zod schemas for session events
│   ├── session.server.ts        # Session server setup
│   ├── session.types.ts         # TypeScript types for session
│   └── env.ts                   # Environment type definitions
├── server.ts                    # Main server file
├── package.json                 # Project dependencies and scripts
├── remix.config.js              # Remix configuration
├── tsconfig.json                # TypeScript configuration
├── worker-configuration.d.ts    # Worker type definitions
└── wrangler.toml                # Cloudflare Workers configuration
```

## 🛠️ How It Works

### 1. Server Setup

The `server.ts` file sets up a Cloudflare Worker that handles both Remix requests and Actor Kit API calls:

````typescript
import { createActorKitRouter } from "actor-kit/worker";
import { WorkerEntrypoint } from "cloudflare:workers";
import type { Env } from "./app/env";

const router = createActorKitRouter<Env>(["todo", "session"]);

export default class Worker extends WorkerEntrypoint<Env> {
  fetch(request: Request): Promise<Response> | Response {
    if (request.url.includes("/api/")) {
      return router(request, this.env, this.ctx);
    }

    const id = this.env.REMIX.idFromName("default");
    return this.env.REMIX.get(id).fetch(request);
  }
}
````

This setup uses `createActorKitRouter` to handle Actor Kit API requests, while delegating other requests to the Remix application.

### 2. Actor Setup

The project uses two main actors: Todo and Session. Here's how they're set up:

#### Todo Actor (`app/todo.server.ts`)

````typescript
import { createMachineServer } from "actor-kit/worker";
import { createTodoListMachine } from "./todo.machine";
import { TodoClientEventSchema, TodoServiceEventSchema } from "./todo.schemas";

export const Todo = createMachineServer({
  createMachine: createTodoListMachine,
  eventSchemas: {
    client: TodoClientEventSchema,
    service: TodoServiceEventSchema,
  },
  options: {
    persisted: true,
  },
});
````

#### Session Actor (`app/session.server.ts`)

````typescript
import { createMachineServer } from "actor-kit/worker";
import { createSessionMachine } from "./session.machine";
import {
  SessionClientEventSchema,
  SessionServiceEventSchema,
} from "./session.schemas";

export const Session = createMachineServer({
  createMachine: createSessionMachine,
  eventSchemas: {
    client: SessionClientEventSchema,
    service: SessionServiceEventSchema,
  },
  options: {
    persisted: true,
  },
});
````

The Session actor is used to store the list of todo list IDs that have been created by the user, allowing for persistence across page reloads.

### 3. Remix Integration

In the root layout (`root.tsx`), we set up the Session actor context:

````typescript
export async function loader({ context }: LoaderFunctionArgs) {
  const fetchSession = createActorFetch<SessionMachine>({
    actorType: "session",
    host: context.env.ACTOR_KIT_HOST,
  });

  const accessToken = await createAccessToken({
    signingKey: context.env.ACTOR_KIT_SECRET,
    actorId: context.sessionId,
    actorType: "session",
    callerId: context.userId,
    callerType: "client",
  });

  const payload = await fetchSession({
    actorId: context.sessionId,
    accessToken,
  });

  return json({
    sessionId: context.sessionId,
    accessToken,
    payload,
    host: context.env.ACTOR_KIT_HOST,
  });
}

export default function App() {
  const { host, sessionId, accessToken, payload } = useLoaderData<typeof loader>();

  return (
    <html lang="en">
      <body>
        <SessionProvider
          host={host}
          actorId={sessionId}
          checksum={payload.checksum}
          accessToken={accessToken}
          initialSnapshot={payload.snapshot}
        >
          <Outlet />
        </SessionProvider>
      </body>
    </html>
  );
}
````

This setup uses `createActorFetch` and `createAccessToken` from Actor Kit to fetch the initial session state and set up the `SessionProvider`.

### 4. Route-Level Integration

In the todo list page (`routes/lists.$id.tsx`), we set up the Todo actor context:

````typescript
export async function loader({ params, context }: LoaderFunctionArgs) {
  const fetchTodoActor = createActorFetch<TodoMachine>({
    actorType: "todo",
    host: context.env.ACTOR_KIT_HOST,
  });

  const accessToken = await createAccessToken({
    signingKey: context.env.ACTOR_KIT_SECRET,
    actorId: params.id!,
    actorType: "todo",
    callerId: context.userId,
    callerType: "client",
  });

  const payload = await fetchTodoActor({
    actorId: params.id!,
    accessToken,
  });

  return json({ listId: params.id, accessToken, payload, host: context.env.ACTOR_KIT_HOST });
}

export default function ListPage() {
  const { listId, accessToken, payload, host } = useLoaderData<typeof loader>();

  return (
    <TodoProvider
      host={host}
      actorId={listId}
      accessToken={accessToken}
      checksum={payload.checksum}
      initialSnapshot={payload.snapshot}
    >
      <TodoList />
    </TodoProvider>
  );
}
````

### 5. Client-Side Component

The `TodoList` component (`app/todo.components.tsx`) demonstrates how to use the Actor Kit context to interact with the state machine:

````typescript
export function TodoList() {
  const todos = TodoContext.useSelector((state) => state.public.todos);
  const send = TodoContext.useSend();
  const [newTodoText, setNewTodoText] = useState("");

  const userId = SessionContext.useSelector((state) => state.public.userId);
  const ownerId = TodoContext.useSelector((state) => state.public.ownerId);
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
            <span style={{ textDecoration: todo.completed ? "line-through" : "none" }}>
              {todo.text}
            </span>
            {isOwner && (
              <>
                <button onClick={() => send({ type: "TOGGLE_TODO", id: todo.id })}>
                  {todo.completed ? "Undo" : "Complete"}
                </button>
                <button onClick={() => send({ type: "DELETE_TODO", id: todo.id })}>
                  Delete
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
````

## 🚀 Getting Started

1. Clone the repository and navigate to the example directory:

   ```bash
   git clone https://github.com/jonmumm/actor-kit.git
   cd actor-kit/examples/remix-actorkit-todo
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Configure the project:

   Update the `wrangler.toml` file to include both TODO and SESSION Durable Objects:

   ```toml
   name = "remix-actorkit-todo"
   main = "dist/index.js"
   compatibility_date = "2024-09-25"

   [[durable_objects.bindings]]
   name = "REMIX"
   class_name = "Remix"

   [[durable_objects.bindings]]
   name = "TODO"
   class_name = "Todo"

   [[durable_objects.bindings]]
   name = "SESSION"
   class_name = "Session"

   [[migrations]]
   tag = "v1"
   new_classes = ["Remix", "Todo", "Session"]
   ```

4. Set up environment variables:
   Create a `.dev.vars` file in the root of your project and add the necessary environment variables.

5. Build and start the development server:

   ```bash
   npm run build
   npm run dev
   ```

6. Open `http://localhost:8787` in your browser to view the application.

## 🚀 Deployment

To deploy the Remix + Actor Kit Todo Example to Cloudflare Workers:

1. Set up environment variables for production using `wrangler secret put`.

2. Build the project:

   ```bash
   npm run build
   ```

3. Deploy the Worker:

   ```bash
   npx wrangler deploy
   ```

This example demonstrates how to create a complex, real-time application using Remix and Actor Kit, leveraging the power of Cloudflare Workers for both the frontend and backend. It showcases how to manage state across multiple clients, handle authentication, and implement owner-based access control, all within a single Worker environment.