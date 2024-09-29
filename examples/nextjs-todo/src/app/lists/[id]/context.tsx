"use client";

import { TodoMachine } from "@/server/todo.actor";
import { createActorKitContext } from "actor-kit/react";

export const TodoActorKitContext = createActorKitContext<TodoMachine>("todo");
export const TodoActorKitProvider = TodoActorKitContext.Provider;
