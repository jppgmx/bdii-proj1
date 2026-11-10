# Transporte universitário — Cajazeiras-PB

Projeto da disciplina de Banco de Dados II para cadastrar paradas no mapa, consultar proximidade e atualizar manualmente a posição de ônibus. Stack definida: Express, Sequelize, PostgreSQL/PostGIS, React, Leaflet e Docker.

**Integrantes:** João Paulo (backend e infraestrutura) e Millena Kelly (frontend).

O React será configurado por Millena Kelly, responsável pelo frontend. O Dockerfile compilará esse projeto e o Express servirá os arquivos resultantes junto com a API, no mesmo endereço.

## Estado atual

Branch `etapa-1`: base Express/Sequelize, migrações, saúde, erros JSON e infraestrutura Docker implementados. Os contratos, os dados e a base do backend vieram da etapa 0. A etapa 1 acrescenta uma rotina isolada de validação Docker/PostGIS e sua execução automática no GitHub Actions. CRUD e consultas de paradas começam na etapa 2.

Cada próxima etapa terá sua própria branch `etapa-N`, mantendo a implementação gradual e os critérios de aceite do plano. O React continua sob responsabilidade de Millena Kelly. `aplicacao-poi/` permanece como referência temporária, independente da execução do backend novo.

O enunciado oficial ainda precisa ser conferido para confirmar publicação, banco na nuvem e prazo. Os 15 testes HTTP/configuração/inicialização passaram e o Compose foi validado. A validação real de Docker/PostGIS passou: build do backend, teste de integração, saúde e preservação das migrações ao recriar os containers. A parte backend/infraestrutura da etapa 1 está validada; o React e o build completo continuam pendentes da entrega do frontend.

## Executar com Docker

Na raiz do projeto:

```bash
cp .env.example .env
docker compose up --build -d
curl http://localhost:3000/api/health
```

O exemplo contém somente credenciais locais de desenvolvimento. Ajuste-as no `.env` e mantenha o arquivo fora do Git. O Compose inicia PostGIS e o alvo `backend`, que funciona sem React. `/api/health` deve retornar `{"status":"ok","database":"ok"}`. A interface em `/` retorna 404 até existir um build React.

O servidor só começa a escutar depois de conectar ao banco, aplicar as migrações e verificar PostGIS. A tabela `schema_migrations` registra as migrações aplicadas; repetir a inicialização não reaplica o que já foi concluído. O script `docker/postgres/init.sql` é executado apenas na primeira criação do volume; a migração também habilita a extensão em um banco externo com as permissões necessárias.

O volume `postgres_data` preserva os dados ao recriar os containers. Para parar sem apagar os dados:

```bash
docker compose down
```

## Desenvolver o backend localmente

Requer Node.js 26, npm e um banco PostgreSQL com PostGIS acessível. Para iniciar apenas o banco com Docker e executar o backend na máquina, depois de criar o `.env`:

```bash
docker compose up -d db
npm --prefix apps/backend ci
npm --prefix apps/backend run dev
```

O backend lê o `.env` da raiz mesmo quando o comando roda em `apps/backend/`. Fora do Docker, use `PG_HOST=localhost`. O Compose configura `PG_HOST=db` automaticamente para o container da aplicação. Para um banco externo, configure host, porta e credenciais; use `PG_SSL=true` quando exigido, com verificação de certificado habilitada.

Para executar as migrações separadamente:

```bash
npm --prefix apps/backend run db:migrate
```

## Verificações

Depois de instalar as dependências:

```bash
npm --prefix apps/backend test
docker compose --env-file .env.example config --quiet
```

Os testes HTTP usam uma conexão de banco simulada para verificar saúde, indisponibilidade, erros e arquivos estáticos. Também verificam configuração e falha de inicialização com banco inacessível. Eles não substituem a integração real.

Com o `.env` configurado e o PostGIS de desenvolvimento disponível, executar:

```bash
npm --prefix apps/backend run test:integration
```

Esse teste aplica migrações no banco configurado, confere execuções concorrentes e repetidas e testa a saúde com PostGIS real. Use um banco de desenvolvimento dedicado.

## Validar a etapa 1 em ambiente isolado

Com Docker e Compose disponíveis, executar na raiz:

```bash
bash scripts/validate-stage-1.sh
```

A rotina compila o alvo `backend`, inicia PostGIS, aguarda a saúde, executa o teste de integração real e recria os containers para conferir a preservação do histórico de migrações. Também verifica saúde, 404 JSON da API e execução sem React dentro da imagem. Utiliza um projeto Compose exclusivo e as credenciais locais de `.env.example`; não precisa criar `.env`.

As portas padrão desse teste são 33000 (API) e 55432 (PostgreSQL). Se estiverem ocupadas:

```bash
API_PORT=33001 PG_PORT=55433 bash scripts/validate-stage-1.sh
```

Ao terminar, inclusive em caso de falha, remove os containers e o volume exclusivos do teste. Os dados desse teste são descartáveis. O ambiente de desenvolvimento iniciado com os comandos anteriores usa outro projeto e volume.

O workflow `.github/workflows/backend.yml` executa instalação pelo lockfile, os testes locais e essa validação em pushes e pull requests. A inclusão do workflow não comprova uma execução remota: conferir o resultado no GitHub após publicar a branch.

## Integrar o React

Millena Kelly entrega `apps/frontend/package.json`, lockfile e `npm run build` com saída em `dist/`. Depois dessa entrega, selecionar o alvo final:

```bash
APP_BUILD_TARGET=production docker compose up --build -d
```

O alvo `production` compila o React e copia `dist/` para `apps/backend/public/`. O Express hospeda frontend e API na mesma porta. No desenvolvimento, o React deve usar proxy de `/api` para `http://localhost:3000`, sem incluir credenciais do banco no cliente.

## Documentação

- [Plano de desenvolvimento e andamento](docs/plano-de-desenvolvimento.md)
- [Contrato da API: rotas, exemplos e validações](docs/contrato-api.md)
- [Contrato de integração: React, Express e Docker](docs/integracao.md)
- [Oito locais fornecidos para demonstração](docs/dados-demonstracao.md) e [dados em JSON](docs/dados-demonstracao.json)
- [Tarefas da dupla e links das issues](docs/tarefas.md)
- [Pendência de conferência do enunciado — issue #13](https://github.com/jppgmx/bdii-proj1/issues/13)

As coordenadas representam locais reais informados pelo usuário em Cajazeiras e Sousa. Os pontos de demonstração não confirmam paradas oficiais de ônibus. A carga desses dados será implementada com o CRUD, na etapa 2.
