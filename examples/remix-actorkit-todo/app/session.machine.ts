import type { CreateMachineProps } from "actor-kit";
import { produce } from "immer";
import { assign, setup } from "xstate";
import type { SessionEvent } from "./session.types";

export const createSessionMachine = ({ id, caller }: CreateMachineProps) =>
  setup({
    types: {
      context: {} as {
        public: {
          id: string;
          userId: string;
          listIds: string[];
        };
        private: Record<string, {}>;
      },
      events: {} as SessionEvent,
    },
    actions: {
      addListId: assign({
        public: ({ context, event }) =>
          produce(context.public, (draft) => {
            if (event.type === "NEW_LIST") {
              draft.listIds.push(event.listId);
            }
          }),
      }),
    },
    guards: {
      isSessionOwner: ({ context, event }) => {
        return event.caller.id === context.public.userId;
      },
    },
  }).createMachine({
    id,
    type: "parallel",
    context: {
      public: {
        id,
        userId: caller.id,
        listIds: [],
      },
      private: {},
    },
    states: {
      lists: {
        on: {
          NEW_LIST: {
            actions: "addListId",
            guard: "isSessionOwner",
          },
        },
      },
    },
  });

export type SessionMachine = ReturnType<typeof createSessionMachine>;
