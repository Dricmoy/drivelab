export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch('/api' + path, { ...options, headers: { 'Content-Type': 'application/json', ...options?.headers } });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const detail = body.detail;
    throw new Error(typeof detail === 'string' ? detail : Array.isArray(detail) ? detail.map((x: { msg: string }) => x.msg).join('; ') : 'Request failed (' + response.status + ').');
  }
  return response.json();
}
export function post<T>(path: string, body: unknown, signal?: AbortSignal) {
  return api<T>(path, { method: 'POST', body: JSON.stringify(body), signal });
}
