import { WithActorKitEvent } from 'actor-kit';
import { z } from 'zod';
import { SessionClientEventSchema, SessionServiceEventSchema } from './session.schemas';

type SessionClientEvent = z.infer<typeof SessionClientEventSchema>;
type SessionServiceEvent = z.infer<typeof SessionServiceEventSchema>;

export type SessionEvent = WithActorKitEvent<SessionClientEvent, 'client'> | WithActorKitEvent<SessionServiceEvent, 'service'>;
