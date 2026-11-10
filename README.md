# Transporte universitário — Cajazeiras-PB

Projeto da disciplina de Banco de Dados II para cadastrar paradas no mapa, consultar proximidade e atualizar manualmente a posição de ônibus. Stack definida: Express, Sequelize, PostgreSQL/PostGIS, React, Leaflet e Docker.

**Integrantes:** João Paulo (backend e infraestrutura) e Millena Kelly (frontend).

O React será configurado por Millena Kelly, responsável pelo frontend. O Dockerfile compilará esse projeto e o Express servirá os arquivos resultantes junto com a API, no mesmo endereço.

## Estado atual

Branch `etapa-3`: backend de geocodificação com Nominatim implementado, além de universidades e CRUD espacial de paradas. `GET /api/geocodificacao?q=...` retorna até cinco resultados com nome e ponto GeoJSON; o backend valida a busca e distingue ausência de resultados, limite, timeout e indisponibilidade.

O cache e o controle de frequência ficam no PostgreSQL e são compartilhados pelas instâncias da aplicação. O frontend continua sob responsabilidade de Millena Kelly, que integra a busca e a atribuição visual. Nenhum arquivo de frontend foi criado nesta etapa.

Docker/PostGIS, CRUD e carga dos oito locais já foram validados. Proximidade e ônibus pertencem às etapas 4 e 5. O enunciado oficial ainda precisa ser conferido para confirmar publicação, banco na nuvem e prazo; o build completo com React depende da entrega do frontend.

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

Os testes HTTP básicos usam uma conexão de banco simulada para verificar saúde, indisponibilidade, erros e arquivos estáticos. Também verificam configuração e falha de inicialização com banco inacessível. Eles não substituem a integração real.

Com o `.env` configurado e o PostGIS de desenvolvimento disponível, executar:

```bash
npm --prefix apps/backend run test:integration
```

A integração aplica migrações e carrega os oito locais de demonstração no banco configurado. Confere migrações concorrentes/repetidas, saúde, CRUD, validações, SRID, índice espacial, bordas e filtros de Cajazeiras/Sousa. Use um banco de desenvolvimento dedicado.

## Carregar os dados de demonstração

A carga é opcional e não roda ao iniciar o servidor. Ela usa o JSON de `docs/dados-demonstracao.json`, em uma transação, e cria oito universidades/campi e oito paradas com IDs estáveis. Repetir o comando preserva registros existentes e edições, sem duplicar IDs. Ônibus serão acrescentados na etapa 5.

Com o Compose iniciado:

```bash
docker compose exec app npm run db:seed
curl 'http://localhost:3000/api/universidades'
curl 'http://localhost:3000/api/paradas?bbox=-38.58,-6.91,-38.53,-6.86'
```

Fora do Docker, com `.env` configurado: `npm --prefix apps/backend run db:seed`. O comando aplica as migrações pendentes antes da carga. A listagem de paradas exige `bbox`; a consulta de um UUID específico usa `/api/paradas/:id`. Os formatos de POST, PUT e DELETE estão no contrato da API.

## Validar o backend em ambiente isolado

Com Docker e Compose disponíveis, executar na raiz:

```bash
bash scripts/validate-backend.sh
```

A rotina compila o alvo `backend`, inicia PostGIS, aguarda a saúde, executa o teste de integração real e recria os containers para conferir a preservação do histórico de migrações. Também verifica saúde, 404 JSON da API e execução sem React dentro da imagem. Utiliza um projeto Compose exclusivo e as credenciais locais de `.env.example`; não precisa criar `.env`.

As portas padrão desse teste são 33000 (API) e 55432 (PostgreSQL). Se estiverem ocupadas:

```bash
API_PORT=33001 PG_PORT=55433 bash scripts/validate-backend.sh
```

Ao terminar, inclusive em caso de falha, remove os containers e o volume exclusivos do teste. Os dados desse teste são descartáveis. O ambiente de desenvolvimento iniciado com os comandos anteriores usa outro projeto e volume.

O workflow `.github/workflows/backend.yml` executa instalação pelo lockfile, os testes locais e essa validação em pushes e pull requests. A inclusão do workflow não comprova uma execução remota: conferir o resultado no GitHub após publicar a branch.

## Buscar localidades com Nominatim

```bash
curl 'http://localhost:3000/api/geocodificacao?q=Cajazeiras%2C%20Para%C3%ADba'
```

`q` exige 3 a 200 caracteres após aparar espaços. A resposta contém até cinco itens `{ nome, localizacao: { type: "Point", coordinates: [longitude, latitude] } }`. Nenhum resultado retorna `[]`; erros usam 400, 429 com `Retry-After`, 502 ou 504 conforme o contrato.

A [política do Nominatim público](https://operations.osmfoundation.org/policies/nominatim/) exige identificação da aplicação, atribuição ao OpenStreetMap e até uma requisição por segundo somando todos os usuários. A busca deve ser explícita por botão ou Enter; não usar autocomplete nem consultas periódicas. O backend envia um User-Agent com o endereço deste repositório, mantém cache persistente por 24 horas (até 1000 buscas, inclusive vazias) e serializa as chamadas por lock no PostgreSQL. Consultas sem cache durante uma chamada ativa ou o intervalo mínimo recebem 429; resultados em cache continuam acessíveis. O intervalo é preservado também após falha do provedor; `Retry-After` do provedor é respeitado até 24 horas (60 segundos se ausente).

Configurações disponíveis em `.env.example`, também encaminhadas pelo Compose:

| Variável | Padrão / finalidade |
| --- | --- |
| `GEOCODING_URL` | `https://nominatim.openstreetmap.org/search`; trocar por serviço compatível com Nominatim sem alterar código. |
| `GEOCODING_USER_AGENT` | Identificação da aplicação e link do repositório; texto ASCII. |
| `GEOCODING_TIMEOUT_MS` | 5000 ms; limite de 1 a 60000 ms. |
| `GEOCODING_CACHE_TTL_SECONDS` | 86400 segundos; limite de 1 a 604800 segundos. |

Millena Kelly deve manter visível `© OpenStreetMap contributors`, com link para [atribuição/licença](https://www.openstreetmap.org/copyright). A API inclui esse endereço no header `Link` com relação `license`. O endpoint pesquisa locais públicos e não restringe a busca à área do mapa.

Os testes automáticos simulam o provedor e não acessam o serviço público. Para uma verificação manual de Cajazeiras e Sousa, com duas chamadas espaçadas:

```bash
GEOCODING_LIVE_CHECK=1 bash scripts/validate-backend.sh
```

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

As coordenadas representam locais reais informados pelo usuário em Cajazeiras e Sousa. Os pontos de demonstração não confirmam paradas oficiais de ônibus. A carga opcional desses dados está disponível pelo comando `db:seed`.
