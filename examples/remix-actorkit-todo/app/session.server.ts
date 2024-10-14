import { createMachineServer } from "actor-kit/worker";
import { setup } from "xstate";
import {
  SessionClientEventSchema,
  SessionInputPropsSchema,
  SessionServiceEventSchema,
} from "./session.schemas";
import { SessionEvent, SessionInput } from "./session.types";

export const Session = createMachineServer({
  machine: setup({
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
      input: {} as SessionInput,
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
          CONNECT: { target: "connected" },
        },
      },
      connected: {},
    },
  }),
  schemas: {
    client: SessionClientEventSchema,
    service: SessionServiceEventSchema,
    input: SessionInputPropsSchema,
  },
  options: {
    persisted: true,
  },
});

export type SessionServer = InstanceType<typeof Session>;
export default Session;
