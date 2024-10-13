import { createMachineServer } from "actor-kit/worker";
import { createSessionMachine } from "./session.machine";
import {
  SessionClientEventSchema,
  SessionServiceEventSchema,
} from "./session.schemas";

export const Session = createMachineServer({
  createMachine: createSessionMachine,
  eventSchemas: {
    client: SessionClientEventSchema,
    service: SessionServiceEventSchema,
  },
  options: {
    persisted: true,
  },
});

export type SessionServer = InstanceType<typeof Session>;
export default Session;
