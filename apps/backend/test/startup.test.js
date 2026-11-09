import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

test('servidor falha antes de escutar quando não consegue conectar ao banco', { timeout: 15000 }, async t => {
  const child = spawn(process.execPath, ['index.js'], {
    cwd: fileURLToPath(new URL('../', import.meta.url)),
    env: {
      ...process.env,
      PG_HOST: '127.0.0.1',
      PG_PORT: '1',
      PG_DATABASE: 'inexistente',
      PG_USER: 'usuario',
      PG_PASSWORD: 'segredo_que_nao_pode_aparecer',
      PG_SSL: 'false',
      API_PORT: '3000',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(() => { if (child.exitCode === null) child.kill(); });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });
  const [code] = await once(child, 'exit');
  assert.equal(code, 1);
  assert.match(output, /Falha ao iniciar o servidor/);
  assert.doesNotMatch(output, /Servidor disponível|segredo_que_nao_pode_aparecer/);
});
