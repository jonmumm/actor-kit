# Remix + ActorKit Todo Example

This project demonstrates how to integrate ActorKit with a Remix application running entirely on Cloudflare Workers. It showcases a real-time, event-driven todo list with owner-based access control, all within a single Worker.

## 🌟 Key Features

- 🚀 Single Cloudflare Worker for both Remix app and ActorKit backend
- 🔄 Real-time synchronization across clients
- 🖥️ Server-side rendering with Remix
- 🎭 State management using XState and ActorKit
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
│   ├── todo.context.tsx         # ActorKit context for todos
│   ├── todo.machine.ts          # Todo state machine
│   ├── todo.schemas.ts          # Zod schemas for todo events
│   ├── todo.server.ts           # Todo server setup
│   ├── todo.types.ts            # TypeScript types for todos
│   └── user.context.tsx         # User context
├── public/                      # Static assets
├── server.ts                    # Main server file
├── package.json                 # Project dependencies and scripts
├── remix.config.js              # Remix configuration
├── tsconfig.json                # TypeScript configuration
├── worker-configuration.d.ts    # Worker type definitions
└── wrangler.toml                # Cloudflare Workers configuration
```

## 🛠️ How It Works

This example leverages Cloudflare Workers to run both the Remix application and the ActorKit backend in a single Worker. This unified approach simplifies deployment and provides seamless integration between the frontend and backend.

### 1. Unified Worker Setup

The `server.ts` file sets up a single Cloudflare Worker that handles both Remix requests and ActorKit API calls:

```typescript
import { logDevReady } from "@remix-run/cloudflare";
import * as build from "@remix-run/dev/server-build";
import { createActorKitRouter } from "actor-kit/worker";
import { WorkerEntrypoint } from "cloudflare:workers";
import type { Env } from "./app/env";

if (process.env.NODE_ENV === "development") {
  logDevReady(build);
}

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

This setup allows the Worker to route API requests to ActorKit and all other requests to the Remix application, providing a seamless experience within a single deployment.

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
   ACTOR_KIT_SECRET=your-secret-key
   ```

4. Start the development server:

   ```bash
   npm run dev
   ```

   This command starts the Cloudflare Worker, which includes both the Remix application and ActorKit backend.

5. Open `http://localhost:8787` in your browser to view the application.

By running everything in a single Cloudflare Worker, this example demonstrates how to create a fully-featured, real-time application with minimal infrastructure complexity.

## 📦 Deployment

To deploy your Remix + ActorKit application to Cloudflare Workers:

1. Build the application:

   ```bash
   npm run build
   ```

2. Deploy to Cloudflare Workers:

   ```bash
   npx wrangler deploy
   ```

Make sure to update the `ACTOR_KIT_SECRET` and other environment variables in your Cloudflare Worker's settings for production use.
