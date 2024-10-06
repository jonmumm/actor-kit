import type { MetaFunction } from '@remix-run/cloudflare';
import React from 'react';

export const meta: MetaFunction = () => {
	return [
		{ title: 'New Remix App' },
		{
			name: 'description',
			content: 'Welcome to Remix! Using Vite and Cloudflare Workers!',
		},
	];
};

export default function Index() {
	return <div style={{ fontFamily: 'system-ui, sans-serif', lineHeight: '1.8' }}>hello world 1</div>;
}
