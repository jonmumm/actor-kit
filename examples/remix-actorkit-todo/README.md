# Remix + Actor Kit Todo Example

This project demonstrates how to integrate Actor Kit with a Remix application running entirely on Cloudflare Workers. It showcases a real-time, event-driven todo list with owner-based access control, all within a single Worker.

## 🌟 Key Features

- 🚀 Single Cloudflare Worker for both Remix app and Actor Kit backend
- 🔄 Real-time synchronization across clients
- 🖥️ Server-side rendering with Remix
- 🎭 State management using XState and Actor Kit
- 🛡️ Type-safe interactions with TypeScript and Zod
- 🔐 Secure handling of public and private data
- 🔒 JWT-based authentication
- 👤 Owner-based access control demonstration

## 📁 Project Structure

```
examples/remix-actorkit-todo/
├── app/
│   ├── routes/
│   │   ├── _index.tsx           # Home page
│   │   └── lists.$id.tsx        # Todo list page
│   ├── entry.client.tsx         # Client entry point
│   ├── entry.server.tsx         # Server entry point
│   ├── env.ts                   # Environment configuration
│   ├── remix.server.ts          # Remix server setup
│   ├── root.tsx                 # Root component
│   ├── todo.components.tsx      # Todo list components
│   ├── todo.context.tsx         # Actor Kit context for todos
│   ├── todo.machine.ts          # Todo state machine
│   ├── todo.schemas.ts          # Zod schemas for todo events
│   ├── todo.server.ts           # Todo server setup
│   ├── todo.types.ts            # TypeScript types for todos
│   └── user.context.tsx         # User context
├── server.ts                    # Main server file
├── package.json                 # Project dependencies and scripts
├── remix.config.js              # Remix configuration
├── tsconfig.json                # TypeScript configuration
├── worker-configuration.d.ts    # Worker type definitions
└── wrangler.toml                # Cloudflare Workers configuration
```

## 🛠️ How It Works

### 1. Unified Worker Setup

The `server.ts` file sets up a single Cloudflare Worker that handles both Remix requests and Actor Kit API calls:

```typescript
import { createActorKitRouter } from "actor-kit/worker";
import { WorkerEntrypoint } from "cloudflare:workers";
import type { Env } from "./app/env";

const router = createActorKitRouter<Env>(["todo"]);

export default class Worker extends WorkerEntrypoint<Env> {
  fetch(request: Request): Promise<Response> | Response {
    if (request.url.includes("/api/")) {
      return router(request, this.env, this.ctx);
    }

    const id = this.env.REMIX.idFromName("default");
    return this.env.REMIX.get(id).fetch(request);
  }
}
```

This setup allows the Worker to route API requests to Actor Kit and all other requests to the Remix application.

### 2. Todo List State Machine

The todo list functionality is implemented as a state machine using XState and Actor Kit. The machine definition is in `app/todo.machine.ts`:

```typescript
export const createTodoListMachine = ({ id, caller }: CreateMachineProps) =>
  setup({
    // ... types and actions ...
  }).createMachine({
    id,
    type: "parallel",
    context: {
      public: {
        ownerId: caller.id,
        todos: [],
        lastSync: null,
      },
      private: {},
    },
    states: {
      Initialization: {
        initial: "Ready",
        states: {
          Ready: {},
        },
      },
      TodoManagement: {
        on: {
          ADD_TODO: {
            actions: ["addTodo"],
            guard: "isOwner",
          },
          TOGGLE_TODO: {
            actions: ["toggleTodo"],
            guard: "isOwner",
          },
          DELETE_TODO: {
            actions: ["deleteTodo"],
            guard: "isOwner",
          },
        },
      },
    },
  });
```

### 3. Server-Side Integration

The todo list page (`app/routes/lists.$id.tsx`) fetches initial state and sets up the Actor Kit context:

```typescript
export async function loader({ params, context }: LoaderFunctionArgs) {
  const host = process.env.ACTOR_KIT_HOST!;
  const fetchTodoActor = createActorFetch<TodoMachine>({
    actorType: "todo",
    host,
  });

  const signingKey = process.env.ACTOR_KIT_SECRET!;

  const listId = params.id;
  if (!listId) {
    throw new Error("listId is required");
  }

  const accessToken = await createAccessToken({
    signingKey,
    actorId: listId,
    actorType: "todo",
    callerId: context.userId,
    callerType: "client",
  });
  const payload = await fetchTodoActor({
    actorId: listId,
    accessToken,
  });
  return json({ listId, accessToken, payload, host });
}
```

### 4. Client-Side Component with Access Control

The `TodoList` component (`app/todo.components.tsx`) demonstrates owner-based access control:

```typescript
export function TodoList() {
  const todos = TodoActorKitContext.useSelector((state) => state.public.todos);
  const send = TodoActorKitContext.useSend();
  const [newTodoText, setNewTodoText] = useState("");

  const userId = useContext(UserContext);
  const ownerId = TodoActorKitContext.useSelector(
    (state) => state.public.ownerId
  );
  const isOwner = ownerId === userId;

  // ... component logic ...

  return (
    <div>
      <h1>Todo List</h1>
      {isOwner && (
        <form onSubmit={handleAddTodo}>
          {/* Add todo form */}
        </form>
      )}
      <ul>
        {/* Todo list items */}
      </ul>
    </div>
  );
}
```

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

3. Set up environment variables:
   Create a `.env` file with:

   ```
   ACTOR_KIT_HOST=http://localhost:8787
   ACTOR_KIT_SECRET=your-secret-key
   ```

4. Start the development server:

   ```bash
   npm run dev
   ```

   This command starts the Cloudflare Worker, which includes both the Remix application and Actor Kit backend.

5. Open `http://localhost:8787` in your browser to view the application.