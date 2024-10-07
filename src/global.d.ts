import type { WebSocket as CloudflareWebSocket } from "@cloudflare/workers-types";

declare global {
  interface WebSocket extends CloudflareWebSocket {}
}

export {};