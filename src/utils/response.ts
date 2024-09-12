export const json = <T>(data: T, status = 200) =>
  Response.json(data, { status });

export const ok = () => json({ ok: true });

export const error = (err: string | { message: string }, status = 500) => {
  console.error("Error response", err);
  return json(
    {
      ok: false,
      error: typeof err === "string" ? err : err.message ?? "Unknown error",
    },
    status
  );
};

export const notFound = () => error("Not found", 404);
