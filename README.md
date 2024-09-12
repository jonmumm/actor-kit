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
import { createMachineServer } from 'actor-kit/server';
import { z } from 'zod';
import { setup } from 'xstate';
import type { WithActorKitEvent } from "./lib/actor-kit/types";

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
const createTodoListMachine = ({ id, send, caller }) =>
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

This example demonstrates:

1. Defining event schemas using Zod
2. Using the `WithActorKitEvent` helper to create event types that include Actor Kit-specific properties
3. Inferring event types from the Zod schemas
4. Creating a state machine that uses these inferred event types
5. Setting up the server using `createMachineServer`

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