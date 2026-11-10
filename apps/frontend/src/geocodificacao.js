import { api, latestRequest } from './paradas.js';

const fallbackRetrySeconds = 60;

function retryDelay(header) {
  const seconds = Number(header);
  return /^\d+$/.test(header?.trim() ?? '') && Number.isSafeInteger(seconds) && seconds <= 86_400
    ? seconds * 1000
    : fallbackRetrySeconds * 1000;
}

export function locationSearch(onResults, onError, now = Date.now) {
  let blockedUntil = 0;
  const request = latestRequest(
    (signal, query) => api(`/api/geocodificacao?q=${encodeURIComponent(query.trim())}`, { signal }),
    onResults,
    (error) => {
      if (error.status === 429) blockedUntil = now() + retryDelay(error.retryAfter);
      onError(error, blockedUntil);
    },
  );

  return {
    run(query) {
      if (now() < blockedUntil) return;
      return request.run(query);
    },
    cancel: request.cancel,
  };
}
