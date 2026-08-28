export const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:3000").replace(/\/+$/, "");

export function apiAssetUrl(url: string) {
  return /^https?:\/\//i.test(url) ? url : `${API_BASE_URL}${url}`;
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers, credentials: "include" });
  if (!response.ok) throw await toApiError(response);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function apiBlob(path: string): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}${path}`, { credentials: "include" });
  if (!response.ok) throw await toApiError(response);
  return response.blob();
}

async function toApiError(response: Response): Promise<ApiError> {
  try {
    const body = await response.json() as { message?: string; detail?: string };
    return new ApiError(body.message ?? body.detail ?? "No se pudo completar la solicitud.", response.status);
  } catch {
    return new ApiError("No se pudo completar la solicitud.", response.status);
  }
}
