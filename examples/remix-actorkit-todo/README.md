# Remix + Actor Kit Todo Example

This project demonstrates how to integrate Actor Kit with a Remix application running entirely on Cloudflare Workers. It showcases a real-time, event-driven todo list with owner-based access control, all within a single Worker.

Try it live: [https://remix-actorkit-todo.jonathanrmumm.workers.dev/](https://remix-actorkit-todo.jonathanrmumm.workers.dev/)

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

### 2. Server-Side Integration

The todo list page (`app/routes/lists.$id.tsx`) fetches initial state and sets up the Actor Kit context:

```typescript
export async function loader({ params, context }: LoaderFunctionArgs) {
  const fetchTodoActor = createActorFetch<TodoMachine>({
    actorType: "todo",
    host: context.env.ACTOR_KIT_HOST,
  });

  const listId = params.id;
  if (!listId) {
    throw new Error("listId is required");
  }

  const accessToken = await createAccessToken({
    signingKey: context.env.ACTOR_KIT_SECRET,
    actorId: listId,
    actorType: "todo",
    callerId: context.userId,
    callerType: "client",
  });
  const payload = await fetchTodoActor({
    actorId: listId,
    accessToken,
  });
  return json({
    listId,
    accessToken,
    payload,
    host: context.env.ACTOR_KIT_HOST,
  });
}

export default function ListPage() {
  const { listId, accessToken, payload, host } = useLoaderData<typeof loader>();

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

### 3. Client-Side Component

The `TodoList` component (`app/todo.components.tsx`) demonstrates an example of access control and how to use the `send` function to dispatch events:

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

  const handleAddTodo = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTodoText.trim()) {
      send({ type: "ADD_TODO", text: newTodoText.trim() });
      setNewTodoText("");
    }
  };

  const handleToggleTodo = (id: string) => {
    send({ type: "TOGGLE_TODO", id });
  };

  const handleDeleteTodo = (id: string) => {
    send({ type: "DELETE_TODO", id });
  };

  return (
    <div>
      <h1>Todo List</h1>
      {isOwner && (
        <form onSubmit={handleAddTodo}>
          {/* Add todo form */}
        </form>
      )}
      <ul>
        {todos.map((todo) => (
          <li key={todo.id}>
            <span>{todo.text}</span>
            <button onClick={() => handleToggleTodo(todo.id)}>
              {todo.completed ? "Undo" : "Complete"}
            </button>
            <button onClick={() => handleDeleteTodo(todo.id)}>
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

In this component:

1. We use `TodoActorKitContext.useSend()` to get the `send` function, which allows us to dispatch events to the Actor Kit state machine.

2. The `handleAddTodo` function demonstrates how to send an `ADD_TODO` event with a payload containing the new todo text.

3. The `handleToggleTodo` function shows how to send a `TOGGLE_TODO` event with the todo's id.

4. The `handleDeleteTodo` function illustrates sending a `DELETE_TODO` event with the todo's id.

These events are defined in the todo state machine and processed accordingly, updating the state and triggering real-time updates across all connected clients.

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

   The `wrangler.toml` file should look like this:

   ```toml
   name = "remix-actorkit-todo"
   main = "dist/index.js"
   compatibility_date = "2024-09-25"

   legacy_assets = "public"

   [define]
   "process.env.REMIX_DEV_ORIGIN" = "'http://127.0.0.1:8002'"
   "process.env.REMIX_DEV_SERVER_WS_PORT" = "8002"

   [[durable_objects.bindings]]
   name = "REMIX"
   class_name = "Remix"

   [[durable_objects.bindings]]
   name = "TODO"
   class_name = "Todo"

   [[migrations]]
   tag = "v1"
   new_classes = ["Remix", "Todo"]
   ```

4. Set up environment variables:
   Create a `.dev.vars` file in the root of your project:

   ```bash
   touch .dev.vars
   ```

   Add the following environment variables to `.dev.vars`:

   ```
   ACTOR_KIT_HOST=http://localhost:8787
   ACTOR_KIT_SECRET=your-secret-key
   NODE_ENV=development
   ```

   Make sure to replace `your-secret-key` with a secure secret key for your project.

5. Update the loader function:
   In `app/routes/lists.$id.tsx`, update the loader function to use the environment variables:

   ```typescript
   export async function loader({ params, context }: LoaderFunctionArgs) {
     const fetchTodoActor = createActorFetch<TodoMachine>({
       actorType: "todo",
       host: context.env.ACTOR_KIT_HOST,
     });

     const listId = params.id;
     if (!listId) {
       throw new Error("listId is required");
     }

     const accessToken = await createAccessToken({
       signingKey: context.env.ACTOR_KIT_SECRET,
       actorId: listId,
       actorType: "todo",
       callerId: context.userId,
       callerType: "client",
     });
     const payload = await fetchTodoActor({
       actorId: listId,
       accessToken,
     });
     return json({
       listId,
       accessToken,
       payload,
       host: context.env.ACTOR_KIT_HOST,
     });
   }
   ```

6. Build the project:

   ```bash
   npm run build
   ```

7. Start the development server:

   ```bash
   npm run dev
   ```

   This command starts the Cloudflare Worker, which includes both the Remix application and Actor Kit backend.

8. Open `http://localhost:8787` in your browser to view the application.

Note: The environment variables are accessed through the `context.env` object in the loader functions. This allows for secure handling of sensitive information and easy configuration between development and production environments.

## 🚀 Deployment

To deploy the Remix + Actor Kit Todo Example to Cloudflare Workers:

1. Set up secrets for production:

   ```bash
   npx wrangler secret put ACTOR_KIT_HOST
   npx wrangler secret put ACTOR_KIT_SECRET
   npx wrangler secret put NODE_ENV
   ```

   Enter the appropriate values when prompted:
   - `ACTOR_KIT_HOST`: Your production Worker URL (e.g., `https://your-worker-name.your-account.workers.dev`)
   - `ACTOR_KIT_SECRET`: A secure, randomly generated secret key
   - `NODE_ENV`: Set to `production`

2. Update `wrangler.toml` for production if necessary:

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

   [[migrations]]
   tag = "v1"
   new_classes = ["Remix", "Todo"]
   ```

3. Build the project:

   ```bash
   npm run build
   ```

4. Deploy the Worker:

   ```bash
   npx wrangler deploy
   ```