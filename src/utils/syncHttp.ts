export function requestJsonSync<T>(method: string, url: string, body?: unknown): T {
  const xhr = new XMLHttpRequest();
  xhr.open(method, url, false);
  xhr.setRequestHeader('Content-Type', 'application/json');

  try {
    xhr.send(body === undefined ? null : JSON.stringify(body));
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Network error');
  }

  if (xhr.status < 200 || xhr.status >= 300) {
    const fallback = `HTTP ${xhr.status}`;
    if (xhr.responseText) {
      try {
        const parsed = JSON.parse(xhr.responseText) as { message?: string };
        throw new Error(parsed.message || fallback);
      } catch {
        throw new Error(fallback);
      }
    }
    throw new Error(fallback);
  }

  if (!xhr.responseText) {
    return null as T;
  }

  return JSON.parse(xhr.responseText) as T;
}
