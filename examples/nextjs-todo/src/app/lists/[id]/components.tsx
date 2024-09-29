// app/todo/[id]/TodoList.tsx
"use client";

import { UserContext } from "@/app/user-context";
import React, { useContext, useState } from "react";
import { TodoActorKitContext } from "./context";

export function TodoList() {
  const todos = TodoActorKitContext.useSelector((state) => state.public.todos);
  const send = TodoActorKitContext.useSend();
  const [newTodoText, setNewTodoText] = useState("");

  const userId = useContext(UserContext);
  const ownerId = TodoActorKitContext.useSelector(
    (state) => state.public.ownerId
  );
  const isOwner = ownerId === userId;
  console.log({ ownerId, userId, isOwner });

  const handleAddTodo = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTodoText.trim()) {
      send({ type: "ADD_TODO", text: newTodoText.trim() });
      setNewTodoText("");
    }
  };

  return (
    <div>
      <h1>Todo List</h1>
      {isOwner && (
        <form onSubmit={handleAddTodo}>
          <input
            type="text"
            value={newTodoText}
            onChange={(e) => setNewTodoText(e.target.value)}
            placeholder="Add a new todo"
          />
          <button type="submit">Add</button>
        </form>
      )}
      <ul>
        {todos.map((todo) => (
          <li key={todo.id}>
            <span
              style={{
                textDecoration: todo.completed ? "line-through" : "none",
              }}
            >
              {todo.text}
            </span>
            <button onClick={() => send({ type: "TOGGLE_TODO", id: todo.id })}>
              {todo.completed ? "Undo" : "Complete"}
            </button>
            <button onClick={() => send({ type: "DELETE_TODO", id: todo.id })}>
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
