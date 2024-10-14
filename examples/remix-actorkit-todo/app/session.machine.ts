import { ActorKitStateMachine } from "actor-kit";
import { produce } from "immer";
import { assign, setup } from "xstate";
import {
  SessionEvent,
  SessionInput,
  SessionPrivateContext,
  SessionPublicContext,
  SessionServerContext,
} from "./session.types";

export const sessionMachine = setup({
  types: {
    context: {} as SessionServerContext,
    events: {} as SessionEvent,
    input: {} as SessionInput,
  },
  actions: {
    addListId: assign({
      public: ({ context, event }) => {
        if (event.type === "NEW_LIST") {
          return produce(context.public, (draft) => {
            draft.listIds.push(event.listId);
          });
        }
        return context.public;
      },
    }),
  },
  guards: {
    isOwner: ({ context, event }) => {
      return context.public.userId === event.caller.id;
    },
  },
}).createMachine({
  id: "session",
  initial: "idle",
  context: ({ input }: { input: SessionInput }) => ({
    public: {
      id: input.id,
      userId: input.caller.id,
      listIds: [],
    },
    private: {},
  }),
  states: {
    idle: {
      on: {
        NEW_LIST: {
          actions: "addListId",
          guard: "isOwner",
        },
      },
    },
  },
}) satisfies ActorKitStateMachine<
  SessionEvent,
  SessionInput,
  SessionPrivateContext,
  SessionPublicContext
>;

export type SessionMachine = typeof sessionMachine;
