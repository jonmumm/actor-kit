"use client";

import React, { createContext } from "react";

export const UserContext = createContext<string>("");

export const UserProvider = ({
  children,
  userId,
}: {
  children: React.ReactNode;
  userId: string;
}) => {
  return <UserContext.Provider value={userId}>{children}</UserContext.Provider>;
};
