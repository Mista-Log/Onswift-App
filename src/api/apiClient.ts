// src/api/apiClient.ts
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// ---------- helpers ----------

const FETCH_TIMEOUT_MS = 30_000;

function fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const signal = options.signal
    ? anySignal([options.signal as AbortSignal, controller.signal])
    : controller.signal;
  return fetch(url, { ...options, signal }).finally(() => clearTimeout(timer));
}

// Combines multiple AbortSignals — aborts as soon as any one fires.
function anySignal(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  for (const s of signals) {
    if (s.aborted) { controller.abort(s.reason); break; }
    s.addEventListener("abort", () => controller.abort(s.reason), { once: true });
  }
  return controller.signal;
}

/** Returns true for network-level failures (no response received from server). */
export function isNetworkError(err: unknown): boolean {
  return err instanceof TypeError || (err instanceof DOMException && err.name === "AbortError");
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------- public fetch ----------

export const publicFetch = async (endpoint: string, options: RequestInit = {}): Promise<Response> => {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetchWithTimeout(`${API_BASE_URL}${endpoint}`, { ...options, headers });
};

// ---------- secure fetch ----------

export const secureFetch = async (
  endpoint: string,
  options: RequestInit = {},
  _retryCount = 0
): Promise<Response> => {
  let token = localStorage.getItem("onswift_access");

  if (!token) {
    console.warn("No access token found");
    const publicPaths = ['/', '/login', '/signup', '/signup/talent', '/signup/creator', '/forgot-password', '/reset-password'];
    const isPublicPage = publicPaths.some((p) => window.location.pathname.includes(p));
    if (!isPublicPage) {
      localStorage.clear();
      window.location.href = '/login';
    }
    throw new Error("No access token");
  }

  const setHeaders = (t: string | null) => {
    const headers = new Headers(options.headers);
    if (t) headers.set("Authorization", `Bearer ${t}`);
    if (!(options.body instanceof FormData) && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    return headers;
  };

  const isGet = !options.method || options.method.toUpperCase() === "GET";

  let response: Response;
  try {
    response = await fetchWithTimeout(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: setHeaders(token),
    });
  } catch (err) {
    // Retry GET requests on network failure (safe — read-only).
    // Mutations are NOT retried — they may have already reached the server.
    if (isGet && _retryCount < 2) {
      await sleep(1_000 * Math.pow(2, _retryCount)); // 1s, then 2s
      return secureFetch(endpoint, options, _retryCount + 1);
    }
    throw err;
  }

  // 401 — attempt token refresh then replay
  if (response.status === 401) {
    const refreshToken = localStorage.getItem("onswift_refresh");
    const publicPaths = ['/', '/login', '/signup', '/signup/talent', '/signup/creator'];
    const isPublicPage = publicPaths.some((p) => window.location.pathname.includes(p));

    if (refreshToken) {
      try {
        const refreshRes = await fetchWithTimeout(`${API_BASE_URL}/api/v1/auth/token/refresh/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh: refreshToken }),
        });

        if (refreshRes.ok) {
          const data = await refreshRes.json();
          localStorage.setItem("onswift_access", data.access);
          response = await fetchWithTimeout(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers: setHeaders(data.access),
          });
        } else {
          console.warn("Token refresh failed, redirecting to login");
          localStorage.clear();
          if (!isPublicPage) window.location.href = '/login';
        }
      } catch (refreshError) {
        console.error("Token refresh error:", refreshError);
        localStorage.clear();
        if (!isPublicPage) window.location.href = '/login';
      }
    } else {
      console.warn("No refresh token found, redirecting to login");
      localStorage.clear();
      if (!isPublicPage) window.location.href = '/login';
    }
  }

  return response;
};
