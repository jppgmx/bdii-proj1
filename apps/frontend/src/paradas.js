export function bboxFromBounds(bounds) {
  return [
    Math.max(-180, bounds.getWest()),
    Math.max(-90, bounds.getSouth()),
    Math.min(180, bounds.getEast()),
    Math.min(90, bounds.getNorth()),
  ].join(',');
}

export function stopsUrl(bbox, proximity) {
  if (!proximity) return `/api/paradas?bbox=${bbox}`;
  const { position: { lat, lng }, radius } = proximity;
  return `/api/paradas/proximas?lat=${lat}&lng=${lng}&raio_m=${radius}&bbox=${bbox}`;
}

export function formatDistance(meters) {
  return `${Math.round(meters)} m`;
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

export function latestRequest(requestId, request, onSuccess, onError, onStart) {
  let controller;
  let lastKey;

  async function run(key) {
    if (key === lastKey) return;
    lastKey = key;
    const id = ++requestId.current;
    controller?.abort();
    controller = new AbortController();
    onStart?.();
    try {
      const result = await request(controller.signal, key);
      if (id === requestId.current) onSuccess(result);
    } catch (error) {
      if (id === requestId.current) onError(error);
    }
  }

  function cancel() {
    requestId.current += 1;
    lastKey = undefined;
    controller?.abort();
  }

  return { run, cancel };
}

export function pointToLatLng({ coordinates: [lng, lat] }) {
  return [lat, lng];
}
