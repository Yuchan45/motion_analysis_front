const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:8000").replace(/\/+$/, "");

export function postForm(path: string, formData: FormData): Promise<Response> {
  return fetch(`${API_BASE_URL}${path}`, { method: "POST", body: formData });
}
