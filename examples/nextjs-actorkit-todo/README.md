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
├── shared/
│   ├── todo.context.tsx
│   ├── todo.machine.ts
│   ├── todo.schemas.ts
│   ├── todo.server.ts
│   └── todo.types.ts
└── nextjs-actorkit-todo/
    ├── src/
    │   ├── app/
    │   │   ├── lists/
    │   │   │   └── [id]/
    │   │   │       ├── components.tsx
    │   │   │       └── page.tsx
    │   │   └── page.tsx
    │   ├── server/
    │   │   └── main.ts
    │   └── middleware.ts
    ├── package.json
    └── README.md
```

## 🛠️ How It Works

### 1. Shared Actor Kit Setup

The `shared` directory contains the core Actor Kit setup, including the state machine definition with access control logic.

### 2. Server-Side Integration

The todo list page (`src/app/lists/[id]/page.tsx`) fetches initial state and sets up the Actor Kit context:

```typescript:examples/nextjs-actorkit-todo/src/app/lists/[id]/page.tsx
startLine: 1
endLine: 43
```

### 3. Client-Side Component with Access Control

The `TodoList` component (`src/app/lists/[id]/components.tsx`) demonstrates owner-based access control:

```typescript:examples/nextjs-actorkit-todo/src/app/lists/[id]/components.tsx
startLine: 1
endLine: 62
```

Note how the component checks if the current user is the owner before rendering the add todo form:

```typescript
const isOwner = ownerId === userId;

// ...

{
  isOwner && <form onSubmit={handleAddTodo}>{/* Add todo form */}</form>;
}
```

This ensures that only the owner of the todo list can add new items.

### 4. Cloudflare Worker Setup

The `src/server/main.ts` file sets up the Cloudflare Worker with Actor Kit:

```typescript:examples/nextjs-actorkit-todo/src/server/main.ts
startLine: 1
endLine: 25
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

4. Start the Cloudflare Worker development server:

   ```bash
   npm run dev-server
   ```

5. In a separate terminal, run the Next.js development server:

   ```bash
   npm run dev
   ```

6. Open `http://localhost:3000` in your browser and start managing your todos!

## 📜 License

This project is [MIT licensed](LICENSE.md).
