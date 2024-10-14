import { createMachineServer } from "actor-kit/worker";
import { sessionMachine } from "./session.machine";
import {
  SessionClientEventSchema,
  SessionInputPropsSchema,
  SessionServiceEventSchema,
} from "./session.schemas";

export const Session = createMachineServer({
  machine: sessionMachine,
  schemas: {
    clientEvent: SessionClientEventSchema,
    serviceEvent: SessionServiceEventSchema,
    inputProps: SessionInputPropsSchema,
  },
  options: {
    persisted: true,
  },
});

export type SessionServer = InstanceType<typeof Session>;
export default Session;
