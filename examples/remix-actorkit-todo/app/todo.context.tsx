"use client";

import { createActorKitContext } from "actor-kit/react";
import type { TodoMachine } from "./todo.machine";

export const TodoContext = createActorKitContext<TodoMachine>("todo");
export const TodoProvider = TodoContext.Provider;
