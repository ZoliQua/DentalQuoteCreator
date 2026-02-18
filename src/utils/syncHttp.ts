import { clearAuthSession, getAuthToken } from './auth';

export function requestJsonSync<T>(method: string, url: string, body?: unknown): T {
  const xhr = new XMLHttpRequest();
  xhr.open(method, url, false);
  if (body !== undefined) {
    xhr.setRequestHeader('Content-Type', 'application/json');
  }
  const token = getAuthToken();
  if (token) {
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
  }

  try {
    xhr.send(body === undefined ? null : JSON.stringify(body));
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Network error');
  }

  if (xhr.status < 200 || xhr.status >= 300) {
    if (xhr.status === 401) {
      clearAuthSession();
    }
    const fallback = `HTTP ${xhr.status}`;
    if (xhr.responseText) {
      let errorMessage = fallback;
      try {
        const parsed = JSON.parse(xhr.responseText) as { message?: string };
        if (parsed.message) errorMessage = parsed.message;
      } catch {
        // response is not JSON, use fallback
      }
      throw new Error(errorMessage);
    }
    throw new Error(fallback);
  }

  if (!xhr.responseText) {
    return null as T;
  }

  return JSON.parse(xhr.responseText) as T;
}
