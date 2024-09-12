# Actor Kit

Actor Kit is a library for creating and managing actor-based state machines in server environments. It provides a framework for handling different types of events from various sources and manages the lifecycle of actors.

## Installation

To install Actor Kit, use your preferred package manager:

```bash
npm install actor-kit
# or
yarn add actor-kit
# or
pnpm add actor-kit
```

## Usage

Here's an example of how to use Actor Kit to create a todo list application, using the `WithActorKitEvent` helper and inferring event types from Zod schemas:

```typescript
import type { WithActorKitEvent } from "actor-kit";
import { createMachineServer } from 'actor-kit/server';
import { z } from 'zod';
import { setup } from 'xstate';

// Define your event schemas
const TodoClientEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ADD_TODO'), text: z.string() }),
  z.object({ type: z.literal('TOGGLE_TODO'), id: z.string() }),
  z.object({ type: z.literal('REMOVE_TODO'), id: z.string() }),
]);

const TodoServiceEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('SYNC_TODOS'), todos: z.array(z.object({ id: z.string(), text: z.string(), completed: z.boolean() })) }),
]);

const TodoOutputEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('TODO_ADDED'), todo: z.object({ id: z.string(), text: z.string(), completed: z.boolean() }) }),
  z.object({ type: z.literal('TODO_TOGGLED'), id: z.string(), completed: z.boolean() }),
  z.object({ type: z.literal('TODO_REMOVED'), id: z.string() }),
]);

// Infer event types using WithActorKitEvent
type TodoClientEvent = WithActorKitEvent<z.infer<typeof TodoClientEventSchema>, "client">;
type TodoServiceEvent = WithActorKitEvent<z.infer<typeof TodoServiceEventSchema>, "service">;

// Combine event types
type TodoEvent = TodoClientEvent | TodoServiceEvent;

// Define your state machine
const createTodoListMachine = ({ id, send, caller }: CreateMachineProps<z.infer<typeof TodoOutputEventSchema>>) =>
  setup({
    types: {
      context: {} as {
        public: {
          todos: Array<{ id: string; text: string; completed: boolean }>;
          lastSync: Date | null;
        };
        history: Array<{ type: string; sentAt: number; [key: string]: any }>;
      },
      events: {} as TodoEvent,
    },
    actions: {
      addTodo: ({ context, event }) => {
        if (event.type === 'ADD_TODO') {
          const newTodo = { id: Date.now().toString(), text: event.text, completed: false };
          context.public.todos.push(newTodo);
          context.history.push({ type: 'TODO_ADDED', todo: newTodo, sentAt: Date.now() });
        }
      },
      toggleTodo: ({ context, event }) => {
        if (event.type === 'TOGGLE_TODO') {
          const todo = context.public.todos.find(t => t.id === event.id);
          if (todo) {
            todo.completed = !todo.completed;
            context.history.push({ type: 'TODO_TOGGLED', id: todo.id, completed: todo.completed, sentAt: Date.now() });
          }
        }
      },
      removeTodo: ({ context, event }) => {
        if (event.type === 'REMOVE_TODO') {
          context.public.todos = context.public.todos.filter(t => t.id !== event.id);
          context.history.push({ type: 'TODO_REMOVED', id: event.id, sentAt: Date.now() });
        }
      },
    },
  }).createMachine({
    id: `todo-list-${id}`,
    context: {
      public: {
        todos: [],
        lastSync: null,
      },
      history: [],
    },
    type: 'parallel',
    states: {
      Initialization: {
        initial: 'Ready',
        states: {
          Ready: {},
        },
      },
      TodoList: {
        on: {
          ADD_TODO: { actions: ['addTodo'] },
          TOGGLE_TODO: { actions: ['toggleTodo'] },
          REMOVE_TODO: { actions: ['removeTodo'] },
        },
      },
    },
  });

// Create your actor server
const TodoListServer = createMachineServer(
  createTodoListMachine,
  {
    client: TodoClientEventSchema,
    service: TodoServiceEventSchema,
    output: TodoOutputEventSchema,
  },
  { persisted: true }
);

export default TodoListServer;
```

## Using `createAccessToken` in a React App

To use `createAccessToken` in a React app, you'll typically create the access token on the server-side and then pass it to your React application. Here's an example of how you might use it in a Remix app:

```typescript
import { assert } from "@/lib/utils";
import type { PlayerPersistedSnapshot } from "@/server/player.machine";
import { useLoaderData, useLocation } from "@remix-run/react";
import { EnvironmentSchema, createAccessToken } from "actor-kit";
import type { LoaderFunctionArgs } from "partymix";
import { z } from "zod";
import { AppContext } from "~/components/app-context";

const ResponseSchema = z.object({
  connectionId: z.string(),
  token: z.string(),
  snapshot: z.custom<PlayerPersistedSnapshot>(),
});

export const loader = async function ({ context }: LoaderFunctionArgs) {
  const playerServer = context.lobby.parties["player"];
  assert(playerServer, "expected playerServer");
  const playerId = crypto.randomUUID();

  const { API_AUTH_SECRET, API_HOST } = EnvironmentSchema.parse(
    context.lobby.env
  );

  const accessToken = await createAccessToken({
    signingKey: API_AUTH_SECRET,
    actorId: playerId,
    callerId: playerId, // This should be dynamically set based on the actual user
    callerType: "client",
    type: "player",
  });

  const input = {};
  const response = await playerServer
    .get(`${playerId}?input=${encodeURIComponent(JSON.stringify(input))}`)
    .fetch({
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  const data = await response.json();
  const parsedData = ResponseSchema.parse(data);
  return { ...parsedData, host: API_HOST };
};

export default function Homepage() {
  const data = useLoaderData<typeof loader>();
  const location = useLocation();

  return (
    <AppContext.Provider
      input={{
        userId: data.connectionId,
        connectionId: data.connectionId,
        connectionToken: data.token,
        host: data.host,
        url: location.pathname + location.search,
        initialSnapshot: data.snapshot as PlayerPersistedSnapshot,
      }}
    >
      {/* Your app components go here */}
    </AppContext.Provider>
  );
}
```

In this example:

1. We use `createAccessToken` in the loader function to generate an access token for the client.
2. The access token is created with the necessary parameters, including the `signingKey`, `actorId`, `callerId`, `callerType`, and `type`.
3. We use this access token to make an authenticated request to the player server.
4. The response, including the access token, is passed to the React component via `useLoaderData`.
5. In the React component, we use the `AppContext.Provider` to make the access token and other necessary data available to child components.

This setup allows your React components to interact with the Actor Kit server using the provided access token, ensuring secure and authenticated communication.

## API Reference

### `actor-kit`

The main package exports:

- Common types and schemas
- `createAccessToken`: Function for creating access tokens

### `actor-kit/server`

Exports:

- `createMachineServer`: The main function for creating an actor server.

#### Parameters

1. `createMachine`: A function that creates the state machine.
   - Receives `props` of type `CreateMachineProps`
2. `eventSchemas`: An object containing Zod schemas for different event types:
   - `client`: Schema for events from end-users or client applications
   - `service`: Schema for events from trusted services or internal microservices
   - `output`: Schema for output events broadcast to connected clients
3. `options`: (Optional) Additional options for the server:
   - `persisted`: Boolean indicating whether the actor's state should be persisted (default: false)

#### Returns

An `ActorServer` class that implements the `Party.Server` interface.

### `WithActorKitEvent<TEvent, TCallerType>`

A type helper that wraps an event type with Actor Kit-specific properties.

#### Type Parameters

- `TEvent`: The base event type
- `TCallerType`: The type of caller ("client" or "service")

#### Added Properties

- `caller`: Information about the event caller
- `cf`: CloudFlare-specific properties (optional)

## Caller Types

Actor Kit supports different types of callers:

- `CLIENT`: Events from end-users or client applications
- `SYSTEM`: Internal events generated by the actor system (handled internally)
- `SERVICE`: Events from trusted external services or internal microservices

## PartyKit Integration

To use Actor Kit with PartyKit, create a `partykit.json` file in your project root:

```json
{
  "$schema": "https://www.partykit.io/schema.json",
  "name": "playitlive",
  "main": "build/index.js",
  "compatibilityDate": "2023-12-22",
  "parties": {
    "player": "server/player.server.ts"
  },
  "serve": "public"
}
```

Key points about this configuration:

- `name`: Set this to your project name (e.g., "playitlive").
- `main`: Points to the built JavaScript file (e.g., "build/index.js").
- `compatibilityDate`: Specifies the PartyKit compatibility date.
- `parties`: Defines the entry points for your party servers. In this example, "player" is set to "server/player.server.ts".
- `serve`: Specifies the directory to serve static files from (e.g., "public").

Adjust these fields as needed for your specific project structure and requirements.