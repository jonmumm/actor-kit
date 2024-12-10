import { EnvWithDurableObjects } from "actor-kit";

export type Env = EnvWithDurableObjects & { EMAIL_SERVICE_API_KEY: string };
