import { createMachineServer } from "actor-kit/worker";
import { assign, setup } from "xstate";
import { z } from "zod";
import { TodoClientEventSchema, TodoServiceEventSchema } from "./todo.schemas";
import { TodoEvent, TodoInput } from "./todo.types";

export const Todo = createMachineServer({
  machine: setup({
    types: {
      context: {} as {
        public: {
          ownerId: string;
          todos: Array<{ id: string; text: string; completed: boolean }>;
          lastSync: number | null;
        };
        private: Record<
          string,
          {
            lastAccessTime?: number;
            userPreferences?: {
              theme: "light" | "dark";
              sortOrder: "asc" | "desc";
            };
          }
        >;
      },
      events: {} as TodoEvent,
      input: {} as TodoInput,
    },
    actions: {
      addTodo: assign({
        public: ({ context, event }) => {
          if (event.type !== "ADD_TODO") return context.public;
          return {
            ...context.public,
            todos: [
              ...context.public.todos,
              { id: crypto.randomUUID(), text: event.text, completed: false },
            ],
            lastSync: new Date().getTime(),
          };
        },
      }),
      toggleTodo: assign({
        public: ({ context, event }) => {
          if (event.type !== "TOGGLE_TODO") return context.public;
          return {
            ...context.public,
            todos: context.public.todos.map((todo) =>
              todo.id === event.id
                ? { ...todo, completed: !todo.completed }
                : todo
            ),
            lastSync: Date.now(),
          };
        },
      }),
      deleteTodo: assign({
        public: ({ context, event }) => {
          if (event.type !== "DELETE_TODO") return context.public;
          return {
            ...context.public,
            todos: context.public.todos.filter((todo) => todo.id !== event.id),
            lastSync: Date.now(),
          };
        },
      }),
    },
    guards: {
      isOwner: ({ context, event }) =>
        event.caller.id === context.public.ownerId,
    },
  }).createMachine({
    id: "todo",
    type: "parallel",
    context: ({ input }: { input: TodoInput }) => ({
      public: {
        ownerId: input.caller.id,
        todos: [],
        lastSync: null,
      },
      private: {},
    }),
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
  }),
  schemas: {
    clientEvent: TodoClientEventSchema,
    serviceEvent: TodoServiceEventSchema,
    inputProps: z.object({
      foo: z.string(),
    }),
  },
  options: {
    persisted: true,
  },
});

export type TodoServer = InstanceType<typeof Todo>;
export default Todo;
