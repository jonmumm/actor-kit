export function assert<T>(
  expression: T,
  errorMessage: string
): asserts expression {
  if (!expression) {
    const error = new Error(errorMessage);
    const stack = error.stack?.split("\n");

    // Find the line in the stack trace that corresponds to where the assert was called.
    // This is typically the third line in the stack, but this may vary depending on the JS environment.
    const assertLine =
      stack && stack.length >= 3 ? stack[2] : "unknown location";

    throw new Error(`${errorMessage} (Assert failed at ${assertLine?.trim()})`);
  }
}
