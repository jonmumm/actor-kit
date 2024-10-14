import type {
  ActorKitSystemEvent,
  WithActorKitEvent,
  WithActorKitInput,
} from "actor-kit";
import { z } from "zod";
import {
  TodoClientEventSchema,
  TodoInputPropsSchema,
  TodoServiceEventSchema,
} from "./todo.schemas";

export type TodoClientEvent = z.infer<typeof TodoClientEventSchema>;
export type TodoServiceEvent = z.infer<typeof TodoServiceEventSchema>;
export type TodoInputProps = z.infer<typeof TodoInputPropsSchema>;

export type TodoEvent =
  | WithActorKitEvent<TodoClientEvent, "client">
  | WithActorKitEvent<TodoServiceEvent, "service">
  | ActorKitSystemEvent;

export type TodoInput = WithActorKitInput<TodoInputProps>;

export type TodoPrivateContext = {
  lastAccessTime?: number;
  userPreferences?: {
    theme: "light" | "dark";
    sortOrder: "asc" | "desc";
  };
};

export type TodoPublicContext = {
  ownerId: string;
  todos: Array<{ id: string; text: string; completed: boolean }>;
  lastSync: number | null;
};

export type TodoServerContext = {
  public: TodoPublicContext;
  private: Record<string, TodoPrivateContext>;
};
