Here's the complete README with all the updates we've discussed:

# Actor Kit Todo List Example

This project demonstrates how to integrate Actor Kit with a Next.js application to create a real-time, event-driven todo list.

## Project Structure

```
src/
├── app/
│   ├── lists/
│   │   └── [id]/
│   │       ├── components.tsx
│   │       ├── context.tsx
│   │       └── page.tsx
│   └── page.tsx
└── server/
    ├── todo.actor.ts
    ├── todo.schemas.ts
    ├── todo.server.ts
    └── todo.types.ts
```

### Key Files

1. `src/server/todo.actor.ts`: Defines the state machine for the todo list using XState.
2. `src/server/todo.server.ts`: Sets up the Actor Server using Actor Kit.
3. `src/server/todo.schemas.ts`: Defines Zod schemas for event validation.
4. `src/server/todo.types.ts`: Contains TypeScript types for events and the state machine.
5. `src/app/lists/[id]/page.tsx`: Server component that fetches initial state and sets up the Actor Kit context.
6. `src/app/lists/[id]/components.tsx`: Client component that renders the todo list and handles user interactions.
7. `src/app/lists/[id]/context.tsx`: Sets up the React context for Actor Kit.

## How It Works

### Context Setup

The Actor Kit context is set up in `src/app/lists/[id]/page.tsx`:

```typescript
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
```

This fetches the initial state and connection details, then wraps the `TodoList` component with the `TodoActorKitProvider`.

### Sending and Selecting Data

In the `TodoList` component (`src/app/lists/[id]/components.tsx`), we use hooks provided by Actor Kit to interact with the state:

```typescript
const todos = TodoActorKitContext.useSelector((state) => state.public.todos);
const send = TodoActorKitContext.useSend();

// Sending an event
const handleAddTodo = (text: string) => {
  send({ type: "ADD_TODO", text });
};

// Rendering todos
{
  todos.map((todo) => (
    <TodoItem
      key={todo.id}
      todo={todo}
      onToggle={() => send({ type: "TOGGLE_TODO", id: todo.id })}
      onDelete={() => send({ type: "DELETE_TODO", id: todo.id })}
    />
  ));
}
```

- `useSelector` is used to access specific parts of the state.
- `useSend` provides a function to dispatch events to the actor.

## State Machine

The todo list state machine (`src/server/todo.actor.ts`) defines:

- Public context: Shared data (todos, lastSync)
- Private context: User-specific data (preferences)
- Events: Actions like adding, toggling, and deleting todos
- Actions: Logic for updating the state based on events

## Getting Started

1. Install dependencies:

   ```
   npm install
   ```

2. Set up environment variables:

   - `ACTOR_KIT_HOST`: The host for your Actor Kit server (e.g., `localhost:1999` for local development)
   - `ACTOR_KIT_SECRET`: Secret key for Actor Kit

3. Start the Actor Kit development server:

   ```
   npm run dev-server
   ```

   This will start the Actor Kit server, typically on `localhost:1999`.

4. In a separate terminal, run the Next.js development server:

   ```
   npm run dev
   ```

   This will start the Next.js app, typically on `localhost:3000`.

5. Open `http://localhost:3000` and click "New List" to create a todo list.

## Key Concepts

- 🖥️ **Server-Side Rendering**: Initial state is fetched server-side for optimal performance.
- ⚡ **Real-time Updates**: Changes are immediately reflected across all connected clients.
- 🔒 **Type Safety**: TypeScript and Zod ensure type safety across the application.
- 🎭 **Event-Driven Architecture**: All state changes are driven by events, providing a clear and predictable data flow.
- 🧠 **State Machine Logic**: XState powers the core logic, making complex state management more manageable.
- 🔄 **Seamless Synchronization**: Actor Kit handles state synchronization between server and clients.

This example showcases how Actor Kit can be used to build complex, real-time applications with a clean separation of concerns and robust state management.
