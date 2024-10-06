import { logDevReady } from '@remix-run/cloudflare';
import * as build from '@remix-run/dev/server-build';
import { ActorServer } from 'actor-kit';
import { createActorKitRouter } from 'actor-kit/worker';
import { WorkerEntrypoint } from 'cloudflare:workers';
import { Remix } from './remix.server';
import { Session, SessionServer } from './session.server';

interface Env {
	REMIX: DurableObjectNamespace<Remix>;
	SESSION: DurableObjectNamespace<SessionServer>;
	ACTOR_KIT_SECRET: string;
	[key: string]: DurableObjectNamespace<ActorServer<any, any>> | unknown;
}

declare module '@remix-run/cloudflare' {
	interface AppLoadContext {
		env: Env;
	}
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
if (process.env.NODE_ENV === 'development') {
	logDevReady(build);
}

const router = createActorKitRouter<Env>(['todo']);

export { Remix, Session };

export default class Worker extends WorkerEntrypoint<Env> {
	fetch(request: Request): Promise<Response> | Response {
		if (request.url.includes('/api/')) {
			return router(request, this.env, this.ctx);
		}

		const id = this.env.REMIX.idFromName('default');
		return this.env.REMIX.get(id).fetch(request);
	}
}
