const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:8000").replace(/\/+$/, "");

function endpoint(path: string): string {
  return `${API_BASE_URL}${path}`;
}

export function analyzeVideoRequest(formData: FormData): Promise<Response> {
  return fetch(endpoint("/analyze"), { method: "POST", body: formData });
}

export function renderVideoRequest(formData: FormData): Promise<Response> {
  return fetch(endpoint("/render"), { method: "POST", body: formData });
}
