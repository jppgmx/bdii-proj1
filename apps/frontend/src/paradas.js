export function bboxFromBounds(bounds) {
  return [
    Math.max(-180, bounds.getWest()),
    Math.max(-90, bounds.getSouth()),
    Math.min(180, bounds.getEast()),
    Math.min(90, bounds.getNorth()),
  ].join(',');
}

export async function api(path, { method = 'GET', body, signal } = {}) {
  let response;
  try {
    response = await fetch(path, {
      method,
      signal,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error('Não foi possível conectar à API.');
  }

  if (response.headers.get('X-Dev-Proxy-Connection-Failed') === '1') {
    throw new Error('Não foi possível conectar à API.');
  }
  if (response.status === 204) return;

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(data?.error?.message ?? `Falha na API (HTTP ${response.status}).`);
    error.fields = data?.error?.fields;
    error.status = response.status;
    error.retryAfter = response.headers.get('Retry-After');
    throw error;
  }
  if (data === null) throw new Error('A API retornou uma resposta inesperada.');
  return data;
}

export function latestRequest(request, onSuccess, onError) {
  let current;

  async function run(...args) {
    current?.abort();
    const controller = new AbortController();
    current = controller;
    try {
      const result = await request(controller.signal, ...args);
      if (!controller.signal.aborted) onSuccess(result);
    } catch (error) {
      if (!controller.signal.aborted) onError(error);
    }
  }

  return { run, cancel: () => current?.abort() };
}

export function pointToLatLng({ coordinates: [lng, lat] }) {
  return [lat, lng];
}
