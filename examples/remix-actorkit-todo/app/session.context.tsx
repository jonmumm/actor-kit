"use client";

import { createActorKitContext } from "actor-kit/react";
import type { SessionMachine } from "./session.machine";

export const SessionContext = createActorKitContext<SessionMachine>("session");
export const SessionProvider = SessionContext.Provider;
