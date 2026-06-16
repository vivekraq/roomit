export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export async function api(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers || {})
    },
    cache: "no-store"
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error || "Request failed");
    error.status = response.status;
    error.details = body.details;
    throw error;
  }
  return body;
}
