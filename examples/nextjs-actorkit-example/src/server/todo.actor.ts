import type { CreateMachineProps } from "actor-kit";
import { assign, setup } from "xstate";
import type { TodoEvent } from "./todo.types";

export const createTodoListMachine = ({ id }: CreateMachineProps) =>
  setup({
    types: {
      context: {} as {
        public: {
          todos: Array<{ id: string; text: string; completed: boolean }>;
          lastSync: number | null;
        };
        private: Record<
          string,
          {
            lastAccessTime?: Date;
            userPreferences?: {
              theme: "light" | "dark";
              sortOrder: "asc" | "desc";
            };
          }
        >;
      },
      events: {} as TodoEvent,
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
  }).createMachine({
    id,
    type: "parallel",
    context: {
      public: {
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
          },
          TOGGLE_TODO: {
            actions: ["toggleTodo"],
          },
          DELETE_TODO: {
            actions: ["deleteTodo"],
          },
        },
      },
    },
  });

export type TodoMachine = ReturnType<typeof createTodoListMachine>;
