# Transporte universitário — Cajazeiras-PB

Projeto da disciplina de Banco de Dados II para cadastrar paradas no mapa, consultar proximidade e atualizar manualmente a posição de ônibus. Stack definida: Express, Sequelize, PostgreSQL/PostGIS, React, Leaflet e Docker.

**Integrantes:** João Paulo (backend e infraestrutura) e Millena Kelly (frontend).

## Tecnologias empregadas

| Camada | Tecnologias e finalidade |
| --- | --- |
| Linguagem | JavaScript com módulos ES; JSX, HTML e CSS na interface. |
| Frontend | React 19, Vite 8 e Leaflet 1.9 para interface, build e mapa interativo. |
| Backend | Node.js 26 e Express 5 para a API HTTP e entrega do build do frontend. |
| Persistência | Sequelize 6 e driver `pg` 8, com PostgreSQL 17 e PostGIS 3.6. |
| Consultas espaciais | Pontos GeoJSON, índices GiST, filtro por área (`bbox`), `ST_DWithin` e `ST_Distance` para proximidade em metros. |
| Serviços de mapa | Tiles do OpenStreetMap e busca de localidades pelo Nominatim, acessado pelo backend. |
| Localização do usuário | API de geolocalização do navegador, mediante permissão. |
| Configuração e execução | dotenv, npm com lockfiles, Docker e Docker Compose. |
| Verificação e integração contínua | Test runner nativo do Node.js e GitHub Actions para testes do backend e integração com PostGIS. |

## Estado atual

A interface React está implementada com mapa Leaflet, geolocalização, cadastro de universidades, criação/edição/exclusão de paradas, busca explícita de localidades e filtro de proximidade de 500 m, 1 km ou 2 km. As paradas são consultadas pela área visível do mapa; o filtro por raio usa a posição autorizada pelo navegador e combina raio e área visível.

O backend oferece universidades, CRUD espacial de paradas, proximidade, geocodificação Nominatim e cadastro de ônibus com atualização manual da posição e do horário. A interface de ônibus ainda não está implementada no frontend atual ([issue #10](https://github.com/jppgmx/bdii-proj1/issues/10)); seus endpoints podem ser demonstrados pelos comandos deste README. Não há rastreamento em tempo real.

O Dockerfile possui o alvo `production` para compilar o React e servir interface e API pelo Express no mesmo endereço. A validação final e publicação ([issue #11](https://github.com/jppgmx/bdii-proj1/issues/11)), a preparação da entrega ([issue #12](https://github.com/jppgmx/bdii-proj1/issues/12)) e a conferência do enunciado ([issue #13](https://github.com/jppgmx/bdii-proj1/issues/13)) continuam pendentes. A existência do build combinado não comprova publicação ou conclusão dessas etapas.

## Executar com Docker

Na raiz do projeto:

```bash
cp .env.example .env
APP_BUILD_TARGET=production docker compose up --build -d
curl http://localhost:3000/api/health
```

O exemplo contém somente credenciais locais de desenvolvimento. Ajuste-as no `.env` e mantenha o arquivo fora do Git. O comando acima inicia PostGIS e o alvo `production`, que inclui o React. Abra `http://localhost:3000` para acessar a interface. `/api/health` deve retornar `{"status":"ok","database":"ok"}`. Sem a seleção explícita de `production`, o Compose usa `APP_BUILD_TARGET` do `.env` (padrão `backend` em `.env.example`); esse alvo executa somente a API e `/` retorna 404 sem arquivos de frontend.

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

Depois de instalar as dependências dos dois projetos (`npm --prefix apps/backend ci` e `npm --prefix apps/frontend ci`):

```bash
npm --prefix apps/backend test
npm --prefix apps/frontend test
npm --prefix apps/frontend run build
docker compose --env-file .env.example config --quiet
```

Os testes HTTP básicos usam uma conexão de banco simulada para verificar saúde, indisponibilidade, erros e arquivos estáticos. Também verificam configuração e falha de inicialização com banco inacessível. Eles não substituem a integração real.

Com o `.env` configurado e o PostGIS de desenvolvimento disponível, executar:

```bash
npm --prefix apps/backend run test:integration
```

A integração aplica migrações e carrega os oito locais de demonstração no banco configurado. Confere migrações concorrentes/repetidas, saúde, CRUD, geocodificação simulada, proximidade em metros, validações, índices, bordas e filtros de Cajazeiras/Sousa. Use um banco de desenvolvimento dedicado.

## Carregar os dados de demonstração

A carga é opcional e não roda ao iniciar o servidor. Ela usa o JSON de `docs/dados-demonstracao.json`, em uma transação, e cria oito universidades/campi, oito paradas e o ônibus `DEMO-01` com IDs estáveis. Repetir o comando preserva registros existentes e edições, sem duplicar IDs. O ônibus começa sem posição; repetir a carga preserva uma posição já salva e seu horário.

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

## Cadastrar ônibus e atualizar posição manualmente

```bash
curl 'http://localhost:3000/api/onibus'
curl -X POST 'http://localhost:3000/api/onibus' -H 'Content-Type: application/json' \
  -d '{"identificacao":"DEMO-02","universidade_id":"10000000-0000-4000-8000-000000000001"}'
curl -X PATCH 'http://localhost:3000/api/onibus/30000000-0000-4000-8000-000000000001/posicao' \
  -H 'Content-Type: application/json' \
  -d '{"posicao_atual":{"type":"Point","coordinates":[-38.54534133432616,-6.889266108880796]}}'
curl 'http://localhost:3000/api/onibus/posicoes?bbox=-38.58,-6.91,-38.53,-6.86'
```

O exemplo usa universidades e o ônibus da carga de demonstração. O cadastro aceita apenas `identificacao` (1 a 60 caracteres) e `universidade_id` existente, e inicia `posicao_atual` e `posicao_atualizada_em` como `null`. A identificação não é única: listagens são ordenadas por identificação e ID.

`GET /api/onibus` alimenta o painel, inclusive com ônibus sem posição. `GET /api/onibus/posicoes` exige `bbox` e retorna somente ônibus posicionados na área, incluindo suas bordas, com índice GiST.

O PATCH aceita apenas o ponto GeoJSON e devolve o estado gravado. O horário vem do banco; o cliente não envia datas nem pode limpar a posição com `null`. Uma segunda sessão vê a alteração ao consultar novamente. Se houver duas gravações, prevalece a última; cancelar na interface não envia requisição. UUID inválido retorna 400 e ônibus inexistente retorna 404. Falhas de validação preservam a última posição confirmada.

## Buscar paradas próximas

```bash
curl 'http://localhost:3000/api/paradas/proximas?lat=-6.889266108880796&lng=-38.54534133432616&raio_m=2000&bbox=-38.58,-6.91,-38.53,-6.86'
```

Os quatro parâmetros são obrigatórios. Latitude e longitude devem estar nas faixas geográficas válidas; `raio_m` deve ser maior que zero e de até 50000 metros. Valores ausentes, repetidos ou inválidos retornam 400 com o campo correspondente. A origem é enviada pelo frontend a partir da posição autorizada do usuário; o backend não usa uma posição padrão.

A consulta combina o raio e o `bbox`: só aparecem paradas que atendem aos dois filtros, incluindo suas bordas. O PostGIS usa `geography`, `ST_DWithin` e um índice GiST específico para proximidade; `ST_Distance` calcula `distancia_m` em metros. Os resultados mantêm os campos da parada e são ordenados por distância crescente e depois por ID. Sem resultados, retorna `[]`. A rota de listagem comum continua exigindo apenas `bbox`.

Com a carga de demonstração e a origem do exemplo, 500 m retornam o ponto 1; 2 km retornam os pontos 1, 5 e 3 nessa ordem; 5 km na área ampliada retornam os cinco locais de Cajazeiras. Essas coordenadas são uma origem simulada apenas para demonstração.

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

O mapa mantém visível `© OpenStreetMap contributors`, com link para [atribuição/licença](https://www.openstreetmap.org/copyright). A API inclui esse endereço no header `Link` com relação `license`. O endpoint pesquisa locais públicos e não restringe a busca à área do mapa.

Os testes automáticos simulam o provedor e não acessam o serviço público. Para uma verificação manual de Cajazeiras e Sousa, com duas chamadas espaçadas:

```bash
GEOCODING_LIVE_CHECK=1 bash scripts/validate-backend.sh
```

## Desenvolver o frontend e gerar o build integrado

Com o banco e o backend iniciados conforme as instruções anteriores, em outro terminal:

```bash
npm --prefix apps/frontend ci
npm --prefix apps/frontend run dev
```

Abra `http://localhost:5173`. O Vite já encaminha `/api` para `http://localhost:3000`. As chamadas do cliente usam caminhos relativos e não recebem credenciais do banco. A geolocalização depende da permissão do navegador e de um contexto seguro (HTTPS ou localhost). Mapa e busca pública de localidades precisam de acesso à internet.

Para gerar somente os arquivos estáticos:

```bash
npm --prefix apps/frontend run build
```

O resultado fica em `apps/frontend/dist/`. Para executar interface e API juntas, use o alvo final:

```bash
APP_BUILD_TARGET=production docker compose up --build -d
```

O alvo `production` compila o React e copia `dist/` para `apps/backend/public/` dentro da imagem. O Express hospeda frontend e API na mesma porta, sem servidor Vite em produção. O build local sozinho não copia os arquivos para o backend local.

## Documentação

- [Plano de desenvolvimento e andamento](docs/plano-de-desenvolvimento.md)
- [Contrato da API: rotas, exemplos e validações](docs/contrato-api.md)
- [Contrato de integração: React, Express e Docker](docs/integracao.md)
- [Oito locais fornecidos para demonstração](docs/dados-demonstracao.md) e [dados em JSON](docs/dados-demonstracao.json)
- [Tarefas da dupla e links das issues](docs/tarefas.md)
- [Pendência de conferência do enunciado — issue #13](https://github.com/jppgmx/bdii-proj1/issues/13)

As coordenadas representam locais reais informados pelo usuário em Cajazeiras e Sousa. Os pontos de demonstração não confirmam paradas oficiais de ônibus. A carga opcional desses dados está disponível pelo comando `db:seed`.
