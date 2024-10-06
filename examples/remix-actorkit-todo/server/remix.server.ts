import { createRequestHandler } from '@remix-run/cloudflare';
import * as build from '@remix-run/dev/server-build';
import { DurableObject } from 'cloudflare:workers';

const handleRemixRequest = createRequestHandler(build);

export class Remix extends DurableObject<Env> {
	async fetch(request: Request) {
		return await handleRemixRequest(request, {
			env: this.env as any,
		});
	}
}
