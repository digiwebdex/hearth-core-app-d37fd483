// Single source of truth for the frontend API base URL + auth headers.
// Every API module and component MUST import from here instead of re-declaring
// `import.meta.env.VITE_API_URL || "http://localhost:4000/api"` and its own
// auth-header helper. This removes the ~40 duplicated copies of the base-URL
// fallback (see docs/v2-master/104-Codebase-Review.md §5) and gives one place
// to change how requests are addressed/authenticated.

/** Base URL for all `/api` calls. Set VITE_API_URL at build time in production. */
export const API_BASE_URL: string =
  (import.meta.env.VITE_API_URL as string | undefined) || "http://localhost:4000/api";

/** Bearer auth headers (+ JSON content type) built from the stored token. */
export function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/** Just the Authorization header (for multipart/form-data requests — no JSON content type). */
export function authHeaderOnly(): Record<string, string> {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}
