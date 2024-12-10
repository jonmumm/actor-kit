import type {
  ActorKitSystemEvent,
  BaseActorKitEvent,
  EnvWithDurableObjects,
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
export type TodoInput = WithActorKitInput<TodoInputProps, EnvWithDurableObjects>;

export type TodoEvent = (
  | WithActorKitEvent<TodoClientEvent, "client">
  | WithActorKitEvent<TodoServiceEvent, "service">
  | ActorKitSystemEvent
) &
  BaseActorKitEvent<EnvWithDurableObjects>;

export type Todo = {
  id: string;
  text: string;
  completed: boolean;
};

export type TodoPublicContext = {
  ownerId: string;
  todos: Todo[];
  lastSync: number | null;
};

export type TodoPrivateContext = Record<string, unknown>;

export type TodoServerContext = {
  public: TodoPublicContext;
  private: Record<string, TodoPrivateContext>;
};
