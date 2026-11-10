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
console.log('Saúde, API JSON e execução sem React verificadas na imagem.');
JS

echo 'Etapa 1: build backend, PostGIS, migrações e persistência validados.'
