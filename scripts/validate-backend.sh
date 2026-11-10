#!/usr/bin/env bash
set -Eeuo pipefail

root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
# Projeto exclusivo: a limpeza remove apenas os containers e o volume deste teste.
project="transporte-validation-$$"
export API_PORT=${API_PORT:-33000}
export PG_PORT=${PG_PORT:-55432}
export APP_BUILD_TARGET=backend
compose=(docker compose --project-name "$project" --env-file "$root/.env.example" -f "$root/compose.yaml")

docker info >/dev/null
cleanup() {
  result=$?
  trap - EXIT
  if (( result != 0 )); then
    "${compose[@]}" logs --no-color || true
  fi
  "${compose[@]}" down --volumes --remove-orphans || true
  exit "$result"
}
trap cleanup EXIT

"${compose[@]}" config --quiet
"${compose[@]}" up --build --detach --wait --wait-timeout 180

# A imagem usa dependências de produção; somente os testes são montados à parte.
"${compose[@]}" run --rm --no-deps \
  --volume "$root/apps/backend/test:/app/apps/backend/test:ro" \
  app npm run test:integration

# Confere também o comando documentado de carga, já com registros existentes.
"${compose[@]}" run --rm --no-deps app npm run db:seed

migration_state() {
  "${compose[@]}" exec -T db sh -c \
    'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT name, applied_at FROM schema_migrations ORDER BY name"'
}
before=$(migration_state)
[[ "$before" == *001-enable-postgis.js* ]]

# Recriar ambos os containers deve preservar o volume e não reaplicar migrações.
"${compose[@]}" up --detach --force-recreate --wait --wait-timeout 180
after=$(migration_state)
[[ "$before" == "$after" ]]

"${compose[@]}" exec -T app node --input-type=module <<'JS'
import assert from 'node:assert/strict';
const base = 'http://127.0.0.1:3000';
const health = await fetch(`${base}/api/health`);
assert.equal(health.status, 200);
assert.deepEqual(await health.json(), { status: 'ok', database: 'ok' });
const missing = await fetch(`${base}/api/inexistente`, { headers: { Accept: 'text/html' } });
assert.equal(missing.status, 404);
assert.match(missing.headers.get('content-type'), /application\/json/);
assert.equal((await fetch(base)).status, 404);
const paradas = await fetch(`${base}/api/paradas?bbox=-38.58,-6.91,-38.22,-6.77`);
assert.equal(paradas.status, 200);
assert.equal((await paradas.json()).length, 8);
const proximas = await fetch(`${base}/api/paradas/proximas?${new URLSearchParams({
  lat: '-6.889266108880796', lng: '-38.54534133432616', raio_m: '2000', bbox: '-38.58,-6.91,-38.53,-6.86',
})}`);
assert.equal(proximas.status, 200);
const nearby = await proximas.json();
assert.deepEqual(nearby.map(row => row.id), [1, 5, 3].map(n => `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`));
assert.equal(nearby[0].distancia_m, 0);
assert.ok(nearby.every(row => typeof row.distancia_m === 'number' && row.distancia_m <= 2000));
console.log('Proximidade validada após recriar aplicação e banco.');
console.log('Oito paradas preservadas após recriar aplicação e banco.');
console.log('Saúde, API JSON e execução sem React verificadas na imagem.');
JS

# Verificação manual opcional; o CI nunca faz chamadas ao serviço público.
if [[ "${GEOCODING_LIVE_CHECK:-0}" == 1 ]]; then
  "${compose[@]}" exec -T app node --input-type=module <<'JS'
import assert from 'node:assert/strict';
for (const q of ['Cajazeiras, Paraíba, Brasil', 'Sousa, Paraíba, Brasil']) {
  const response = await fetch(`http://127.0.0.1:3000/api/geocodificacao?${new URLSearchParams({ q })}`);
  const result = await response.json();
  assert.equal(response.status, 200, JSON.stringify(result));
  assert.ok(result.length > 0 && result.length <= 5);
  assert.ok(result.every(row => row.localizacao.type === 'Point' && row.localizacao.coordinates.every(Number.isFinite)));
  console.log(`Nominatim real: ${q} — ${result.length} resultado(s).`);
  await new Promise(resolve => setTimeout(resolve, 1100));
}
JS
fi

echo 'Backend: build, PostGIS, CRUD espacial, migrações e persistência validados.'
