import { useEffect, useState } from 'react';
import MapView from './MapView.jsx';

const connectionError = 'Não foi possível conectar à API.';
const invalidResponse = 'A API retornou uma resposta de saúde inesperada.';

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

  return (
    <main>
      <header>
        <h1>Transporte universitário</h1>
        <p>Cajazeiras e Sousa · Paraíba</p>
      </header>
      <div className="layout">
        <MapView />
        <aside aria-labelledby="panel-title">
          <h2 id="panel-title">Painel</h2>
          <p role="status">{health}</p>
          <p>Os formulários serão habilitados nas próximas etapas.</p>
          <form>
            <fieldset disabled>
              <legend>Buscar localidade</legend>
              <label htmlFor="localidade">Nome da localidade</label>
              <input id="localidade" type="search" />
              <button type="button">Buscar</button>
            </fieldset>
          </form>
          <form>
            <fieldset disabled>
              <legend>Cadastrar parada</legend>
              <label htmlFor="parada">Nome da parada</label>
              <input id="parada" />
              <label htmlFor="universidade">Universidade</label>
              <select id="universidade">
                <option>Selecione uma universidade</option>
              </select>
              <button type="button">Salvar</button>
            </fieldset>
          </form>
        </aside>
      </div>
    </main>
  );
}
