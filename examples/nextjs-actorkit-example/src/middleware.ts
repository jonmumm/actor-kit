// middleware.ts
import { NextRequest, NextResponse } from "next/server";

// Helper function to parse the session token from cookies
function parseSessionToken(request: NextRequest) {
  const sessionToken = request.cookies.get("sessionToken")?.value;
  if (sessionToken) {
    const [userId, sessionId] = sessionToken.split(":");
    return { userId, sessionId };
  }
  return null;
}

export async function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);

  // Try to get existing session from cookie
  const existingSession = parseSessionToken(request);

  let userId: string;
  let sessionId: string;
  let newSessionToken: string | undefined;

  if (existingSession) {
    // Use existing session
    userId = existingSession.userId;
    sessionId = existingSession.sessionId;
  } else {
    // Create new session
    userId = uuidv4();
    sessionId = uuidv4();
    newSessionToken = `${userId}:${sessionId}`;
  }

  // Set headers
  requestHeaders.set("x-session-id", sessionId);
  requestHeaders.set("x-user-id", userId);

  // Additional headers you might want
  requestHeaders.set("x-page-session-id", uuidv4());
  requestHeaders.set("x-url", request.url);

  // Create the response
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // Set new session token as a cookie if it was created
  if (newSessionToken) {
    response.cookies.set("sessionToken", newSessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: "/",
    });
  }

  return response;
}

function uuidv4() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0,
      v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
