import { useCallback, useEffect, useRef, useState } from 'react';
import MapView from './MapView.jsx';
import { api, formatDistance, latestRequest, pointToLatLng, stopsUrl } from './paradas.js';
import { UniversityForm, StopForm } from './Forms.jsx';

const connectionError = 'Não foi possível conectar à API.';
const invalidResponse = 'A API retornou uma resposta de saúde inesperada.';
const radii = [[500, '500 m'], [1000, '1 km'], [2000, '2 km']];

async function checkHealth(signal) {
  let response;

  try {
    response = await fetch('/api/health', { signal });
  } catch {
    return connectionError;
  }

  if (response.headers.get('X-Dev-Proxy-Connection-Failed') === '1') {
    return connectionError;
  }

  if (!response.ok) {
    return `A API retornou um erro (HTTP ${response.status}).`;
  }

  try {
    const health = await response.json();
    if (response.status === 200 && health?.status === 'ok' && health.database === 'ok') {
      return 'API e banco de dados disponíveis.';
    }
  } catch {
    return invalidResponse;
  }

  return invalidResponse;
}

export default function App() {
  const [health, setHealth] = useState('Verificando a disponibilidade da API…');

  useEffect(() => {
    const controller = new AbortController();
    checkHealth(controller.signal).then((message) => {
      if (!controller.signal.aborted) {
        setHealth(message);
      }
    });
    return () => controller.abort();
  }, []);

  const [universities, setUniversities] = useState([]);
  const [universityStatus, setUniversityStatus] = useState({ loading: true });
  const [stopList, setStopList] = useState({ loading: true, items: [] });
  const [selected, setSelected] = useState(null);
  const [point, setPoint] = useState(null);
  const [formKey, setFormKey] = useState(0);
  const [newUniversity, setNewUniversity] = useState('');
  const [busy, setBusy] = useState(false);
  const [userPosition, setUserPosition] = useState(null);
  const [radius, setRadius] = useState(null);
  const bounds = useRef(null);
  const proximity = useRef(null);
  const requestId = useRef(0);

  const [stopRequests] = useState(() => latestRequest(
    requestId,
    (signal, bbox, filter) => api(stopsUrl(bbox, filter), { signal }),
    (items) => setStopList({ items }),
    (error) => setStopList({ items: [], error: error.message }),
  ));

  const loadStops = useCallback((bbox) => {
    bounds.current = bbox;
    setStopList({ loading: true, items: [] });
    stopRequests.run(bbox, proximity.current);
  }, [stopRequests]);

  useEffect(() => () => stopRequests.cancel(), [stopRequests]);

  useEffect(() => {
    const controller = new AbortController();
    api('/api/universidades', { signal: controller.signal }).then((items) => {
      if (controller.signal.aborted) return;
      setUniversities(items);
      setUniversityStatus({});
    }).catch((error) => {
      if (!controller.signal.aborted) setUniversityStatus({ error: error.message });
    });
    return () => controller.abort();
  }, []);

  const editStop = useCallback((stop) => {
    if (busy) return;
    setSelected(stop);
    setPoint(pointToLatLng(stop.localizacao));
    setFormKey((key) => key + 1);
  }, [busy]);

  function resetStop() {
    setSelected(null);
    setPoint(null);
    setFormKey((key) => key + 1);
  }

  function refreshStops() {
    if (bounds.current) loadStops(bounds.current);
  }

  function selectRadius(nextRadius) {
    if (nextRadius === radius) return;
    proximity.current = nextRadius === null ? null : { position: userPosition, radius: nextRadius };
    stopRequests.cancel();
    setRadius(nextRadius);
    // Enquadrar o círculo dispara moveend com a nova área visível.
    if (nextRadius === null) refreshStops();
    else setStopList({ loading: true, items: [] });
  }

  function addUniversity(university) {
    setUniversities((items) => [...items, university].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')));
    setNewUniversity(university.id);
  }

  return (
    <main>
      <header>
        <h1>Transporte universitário</h1>
        <p>Cajazeiras e Sousa · Paraíba</p>
      </header>
      <div className="layout">
        <MapView stops={stopList.items} draft={point} onBounds={loadStops} onPoint={setPoint}
          onEdit={editStop} onLocation={setUserPosition} userPosition={userPosition} radius={radius} />
        <aside aria-labelledby="panel-title">
          <h2 id="panel-title">Painel</h2>
          <p role="status">{health}</p>
          {universityStatus.loading && <p role="status">Carregando universidades…</p>}
          {universityStatus.error && <p role="alert">{universityStatus.error}</p>}
          <UniversityForm onCreated={addUniversity} disabled={universityStatus.loading} />
          <StopForm key={formKey} stop={selected} universities={universities} newUniversity={newUniversity}
            point={point} busy={busy} setBusy={setBusy} onReset={resetStop} onSaved={refreshStops} />
          <fieldset disabled={!userPosition}>
            <legend>Raio de busca</legend>
            {radii.map(([value, label]) => (
              <button key={value} type="button" aria-pressed={radius === value} onClick={() => selectRadius(value)}>
                {label}
              </button>
            ))}
            <button type="button" disabled={radius === null} onClick={() => selectRadius(null)}>Limpar filtro</button>
          </fieldset>
          <section className="stop-list" aria-labelledby="stop-list-title">
            <h3 id="stop-list-title">{radius === null ? 'Paradas na área visível' : 'Paradas no raio e na área visível'}</h3>
            {stopList.loading && <p role="status">Carregando paradas…</p>}
            {stopList.error && (
              <div role="alert">
                <p>{stopList.error}</p>
                <button type="button" onClick={refreshStops}>Tentar novamente</button>
              </div>
            )}
            {!stopList.loading && !stopList.error && stopList.items.length === 0 &&
              <p role="status">{radius === null ? 'Nenhuma parada na área visível.' : 'Nenhuma parada no raio e na área visível.'}</p>}
            <ul>
              {stopList.items.map((stop) => (
                <li key={stop.id}>
                  <button type="button" disabled={busy} onClick={() => editStop(stop)}>{stop.nome}</button>
                  {radius !== null && <small>{formatDistance(stop.distancia_m)}</small>}
                  <small>Atualizada em <time dateTime={stop.updatedAt}>
                    {new Date(stop.updatedAt).toLocaleString('pt-BR')}
                  </time></small>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </main>
  );
}
