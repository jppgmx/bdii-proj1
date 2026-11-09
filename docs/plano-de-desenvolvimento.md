# Plano de desenvolvimento — Transporte universitário em Cajazeiras-PB

## 1. Objetivo e base de referência

Construir uma aplicação simples para cadastrar paradas de transporte universitário, consultá-las no mapa de Cajazeiras-PB e atualizar manualmente a posição de ônibus. A prioridade é cumprir os requisitos da disciplina com Express, PostgreSQL/PostGIS, React, Leaflet e Docker.

A pasta `aplicacao-poi/` contém uma aplicação completa de referência, com backend e frontend. Ela servirá para entender e adaptar os fluxos existentes; não será uma dependência da aplicação final e será removida depois da substituição e da validação. A temática de transporte do plano anterior será mantida: o CRUD de POIs será a base do CRUD de paradas.

### O que a referência já contém

| Parte | Implementação encontrada | Uso no novo projeto |
| --- | --- | --- |
| Servidor | Express com JSON, CORS e arquivos de `public/` servidos pelo próprio backend. | Manter Express e a hospedagem do frontend pelo servidor; substituir os arquivos estáticos pelo build do React. |
| Banco | PostgreSQL com `pg` e Sequelize; conexão por variáveis de ambiente. | Manter essa base, habilitar PostGIS e organizar a criação do esquema. |
| Modelo | POI com UUID, nome, descrição, tipo e localização `GEOMETRY('POINT')`. | Adaptar para parada, com vínculo à universidade e SRID 4326 explícito. As categorias genéricas de POI não serão necessárias para a temática. |
| API | CRUD em `/api/pois`, com `GET`, `POST`, `PUT` e `DELETE`. | Preservar o padrão simples de rotas e adaptar para `/api/paradas`. |
| Mapa | Leaflet e OpenStreetMap, centro inicial `[-6.8863, -38.5559]` e zoom 14. | Usar a mesma região inicial de Cajazeiras-PB no React. |
| Interação | Clique para escolher localização, seleção de POI, formulário, edição por arraste e exclusão. | Reproduzir esses fluxos com componentes React. |
| Geolocalização | Solicitação da posição do navegador e recentralização quando encontrada. | Manter, acrescentando tratamento de falhas e marcador próprio para o usuário. |
| Busca de local | Consulta direta ao Nominatim por botão, usando o primeiro resultado. | Adaptar para busca com seleção de resultado e integração controlada pelo backend. |

A referência ainda lista todos os POIs com `findAll()`, sem filtro espacial, e usa `Poi.sync()` no carregamento do modelo. Não há Docker, React, busca por distância, filtro por área visível, universidades ou ônibus. Essas partes são tarefas novas, não funcionalidades prontas.

O arquivo `Projeto 1 - Banco II.md`, citado no plano anterior, não está disponível neste repositório. A lista de requisitos acadêmicos anteriormente registrada foi preservada para conferência com o enunciado; datas e exigências externas precisam ser confirmadas na fonte.

## 2. Escopo e responsabilidades

| Funcionalidade | Entrega esperada |
| --- | --- |
| Universidades | Cadastro e listagem simples para associar às paradas e aos ônibus. |
| Paradas | CRUD de nome, descrição opcional, universidade e ponto escolhido no mapa. |
| Mapa | Leaflet com base em Cajazeiras-PB, posição do usuário quando autorizada e atribuição do provedor. |
| Busca por localidade | Pesquisar um endereço/local, selecionar um resultado e ajustar a posição antes de salvar. |
| Área visível | Consultar no PostGIS somente as paradas da região exibida. |
| Proximidade | Consultar paradas dentro de um raio em metros da posição do usuário. |
| Ônibus | Cadastro simples, marcador próprio e atualização manual da posição com horário persistido. |
| Execução e entrega | Docker Compose para aplicação e banco local; build do React servido pelo Express na publicação. |

Ficam fora desta versão: login, rastreamento GPS de ônibus, WebSocket, histórico de posições, previsão de chegada, cálculo de itinerários, notificações e aplicativo nativo. A posição do ônibus será informada manualmente, por clique ou arraste e confirmação de salvamento.

| Responsável | Responsabilidade |
| --- | --- |
| Você — backend e infraestrutura | Express, Sequelize, PostGIS, validações, consultas espaciais, Dockerfile, Compose e publicação do servidor que também hospeda o React. |
| Sua colega — frontend | Configurar o projeto React, adicionar Leaflet, criar interface e formulários, integrar a API e garantir o comando de build. |
| Dupla | Combinar o contrato da API e do build, integrar, revisar os requisitos e preparar a demonstração. |

A configuração do React pertence à sua colega. Sua tarefa é deixar o Dockerfile preparado para instalar as dependências e compilar o frontend quando ela entregar o projeto, sem depender do `public/` antigo.

## 3. Estrutura e execução definidas

```text
apps/
  backend/
    database/
    model/
    routes/
    public/                 # destino do build React na imagem final
    index.js
    package.json
    package-lock.json
  frontend/                 # projeto React configurado pela colega
    package.json
    package-lock.json
    ...
docker/
  postgres/
    init.sql                # habilita PostGIS no banco local
Dockerfile
compose.yaml
.dockerignore
.env.example
docs/
  plano-de-desenvolvimento.md
  contrato-api.md
  integracao.md
  dados-demonstracao.md
  dados-demonstracao.json
  tarefas.md
README.md
aplicacao-poi/               # referência temporária; remover na etapa final
```

Manter a organização próxima da referência, com modelos e rotas, sem introduzir camadas ou serviços desnecessários. Usar Express com Sequelize e `pg`; o Leaflet será uma dependência do frontend React.

### Contrato entre React, Docker e Express

- Contexto de build do Docker na raiz, com acesso a `apps/backend` e `apps/frontend`.
- Sua colega entrega `npm run build`, lockfile e diretório de saída documentado. Usar `dist/` como convenção inicial; se a configuração escolhida gerar outro caminho, ajustar o estágio de cópia.
- Dockerfile com múltiplos estágios: instalar e compilar o frontend; instalar apenas as dependências de produção do backend; copiar o build React para `apps/backend/public/` na imagem final.
- A imagem final executa o Express. O React compilado é composto por arquivos estáticos; não precisa de outro servidor em produção.
- O navegador chama `/api/...` na mesma origem. No desenvolvimento, o servidor do React deve encaminhar essas chamadas ao Express por proxy.
- Registrar as rotas `/api` antes dos arquivos estáticos. Rotas de API inexistentes devem retornar erro JSON; se houver rotas de navegação no React, o fallback de `index.html` deve atendê-las sem interceptar a API.
- O Compose terá os serviços `app` e `db`, volume persistente para o banco, healthcheck e configuração de conexão. O serviço `app` será construído a partir do Dockerfile da raiz.
- Dentro do Compose, o host do banco será `db`. Na publicação, aceitar as credenciais e o host do banco externo por ambiente, incluindo SSL quando exigido pelo provedor.
- O Dockerfile poderá ser escrito antes da entrega do React, mas seu build completo só poderá ser validado depois que os arquivos e o comando combinados existirem.

## 4. Modelo e contratos mínimos

| Entidade | Campos | Regras |
| --- | --- | --- |
| Universidade | `id`, `nome`, `sigla`, `campus` opcional | Nome obrigatório; cada registro representa uma universidade/campus. |
| Parada | `id`, `nome`, `descricao` opcional, `universidade_id`, `localizacao`, datas | Nome, universidade existente e ponto obrigatórios. |
| Ônibus | `id`, `identificacao`, `universidade_id`, `posicao_atual`, `posicao_atualizada_em` | Pode começar sem posição; horário da posição definido pelo servidor. |

Nesta versão, cada parada se vincula a uma universidade. Não implementar associação de várias universidades por parada agora.

Decisões espaciais e da API:

- UUIDs e datas podem seguir o padrão do modelo da referência.
- Usar `geometry(Point, 4326)` para paradas e posições dos ônibus, com extensão PostGIS habilitada antes da criação das tabelas.
- Receber e devolver o ponto no campo `localizacao` como GeoJSON: `{ "type": "Point", "coordinates": [longitude, latitude] }`. Para ônibus, usar `posicao_atual` no mesmo formato.
- Para simplificar a adaptação, devolver arrays de objetos nas listagens, mantendo a geometria no respectivo campo. Não é necessário transformar todas as respostas em `FeatureCollection`.
- Leaflet usa `[latitude, longitude]` para posicionar marcadores; converter a ordem ao consumir ou enviar GeoJSON.
- Filtrar a área visível no banco usando `bbox=west,south,east,north`, SRID 4326 e índice GiST sobre a geometria.
- Calcular proximidade em metros com `ST_DWithin` sobre `geography` e retornar `distancia_m` calculada com `ST_Distance`. Criar também índice GiST compatível com a expressão convertida para `geography`.
- Validar coordenadas, UUIDs, campos obrigatórios, universidade existente, `bbox` e raio. Usar consultas parametrizadas e erros JSON com mensagem legível, sem expor detalhes internos do banco.

| Método e rota | Finalidade |
| --- | --- |
| `GET /api/health` | Verificar servidor e conexão com o banco. |
| `GET /api/universidades` | Listar universidades. |
| `POST /api/universidades` | Cadastrar universidade. |
| `GET /api/paradas?bbox=west,south,east,north` | Listar paradas dentro da área visível. |
| `GET /api/paradas/proximas?lat=...&lng=...&raio_m=2000&bbox=...` | Listar paradas dentro do raio e da área visível, ordenadas por distância. |
| `GET /api/paradas/:id` | Consultar uma parada. |
| `POST /api/paradas` | Criar uma parada. |
| `PUT /api/paradas/:id` | Atualizar os dados e a localização de uma parada. |
| `DELETE /api/paradas/:id` | Excluir uma parada, retornando 204. |
| `GET /api/geocodificacao?q=...` | Pesquisar localidades para o formulário. |
| `GET /api/onibus` | Listar ônibus para seleção, inclusive os que não têm posição. |
| `POST /api/onibus` | Cadastrar identificação e universidade do ônibus. |
| `GET /api/onibus/posicoes?bbox=...` | Listar ônibus posicionados dentro da área visível. |
| `PATCH /api/onibus/:id/posicao` | Salvar a posição manual e o horário da atualização. |

Registrar `/paradas/proximas` antes de `/paradas/:id`. Exigir `bbox` nas listagens de marcadores; sua ausência deve gerar erro de validação. Detalhar exemplos de requisição, resposta e erro em `docs/contrato-api.md` antes de integrar cada fluxo.

## 5. Tarefas de desenvolvimento

As decisões de stack, região e hospedagem do frontend já estão tomadas neste plano. As caixas abaixo representam trabalho ainda pendente; os recursos presentes em `aplicacao-poi/` ainda precisam ser adaptados e validados na nova aplicação.

Os oito locais reais fornecidos pelo usuário, incluindo as unidades de Sousa e São Gonçalo, estão registrados em [dados de demonstração](dados-demonstracao.md), com as coordenadas completas e uma versão [JSON](dados-demonstracao.json) para os futuros seeds e mocks. Esses locais serão pontos de demonstração; não pressupõem paradas oficiais de ônibus. O mapa começa em Cajazeiras e permite navegar até Sousa.

### Etapa 0 — Registrar os contratos da dupla

**Dupla**

- [x] Criar [contrato da API](contrato-api.md) a partir das rotas acima, com exemplos, validações e códigos de resposta.
- [x] Definir os [dados de demonstração](dados-demonstracao.md) com os oito locais de Cajazeiras e Sousa fornecidos pelo usuário.
- [x] Registrar o [contrato de integração](integracao.md): npm com lockfile, `npm run build`, saída `dist/`, chamadas relativas a `/api` e Express servindo o build.
- [x] Registrar tarefas de backend, frontend e integração no GitHub, com vínculos em [tarefas da dupla](tarefas.md).
- [ ] Conferir no enunciado os requisitos de publicação, banco na nuvem e prazo de entrega.

**Concluída quando:** cada pessoa conhece sua entrega e consegue trabalhar com os mesmos formatos de dados.

**Situação:** entregas locais da etapa 0 preparadas e 13 issues registradas no GitHub. Conforme a orientação de implementar por branches, a branch `etapa-0` também inclui a base do backend e os arquivos de infraestrutura previstos na etapa 1. As próximas etapas usarão branches `etapa-N`. A conferência do enunciado permanece pendente na [issue #13](https://github.com/jppgmx/bdii-proj1/issues/13), pois o documento oficial não está no repositório. A configuração do React permanece com a colega.

### Etapa 1 — Extrair o backend e preparar Docker/PostGIS

**Você**

- [x] Criar o projeto em `apps/backend`, adaptando a inicialização do Express, a conexão Sequelize e o padrão de rotas da referência.
- [x] Configurar variáveis de porta e conexão, incluindo porta do PostgreSQL, com `.env.example` sem credenciais reais.
- [x] Criar `docker/postgres/init.sql` para habilitar PostGIS no banco local e documentar que a inicialização ocorre na criação do volume.
- [x] Criar migrações explícitas para o esquema, substituindo o `Poi.sync()` executado ao importar o modelo; a primeira habilita PostGIS, e as tabelas de domínio entram nas etapas seguintes.
- [x] Criar `GET /api/health` e tratar falha de conexão antes de considerar o servidor pronto.
- [x] Preparar Dockerfile com build React e Express servindo `public/`, conforme o contrato da seção 3; alvo `backend` disponível antes da entrega do React e alvo `production` para o pacote completo.
- [x] Criar `compose.yaml` com aplicação, PostGIS, volume persistente e espera pela saúde do banco; definir como executar as migrações.
- [x] Criar `.dockerignore`, excluindo dependências locais, arquivos `.env`, `.git` e `aplicacao-poi/` do contexto enviado ao build.
- [ ] Validar o serviço PostGIS e o backend; registrar que a validação da imagem completa depende da entrega do React.

**Sua colega**

- [ ] Configurar React em `apps/frontend`, com lockfile, scripts de desenvolvimento e build.
- [ ] Preparar layout simples com mapa, painel e formulários.
- [ ] Configurar proxy de `/api` para o Express no desenvolvimento e verificar `/api/health`.

**Concluída quando:** backend conecta ao PostGIS e o contrato do build está documentado. A imagem completa será validada na etapa 6.

**Verificação parcial:** testes HTTP, configuração e falha de inicialização executados com Node.js 26; configuração Compose válida. Não houve acesso ao socket Docker nesta sessão, inclusive fora do sandbox. Permanecem pendentes o build das imagens e o teste de integração com PostGIS real, disponível em `npm --prefix apps/backend run test:integration`. A etapa 1 ainda não está concluída.

### Etapa 2 — Adaptar o CRUD de POIs para paradas

**Você**

- [ ] Criar migrações e modelos de universidade e parada, adaptando os campos do POI e explicitando SRID 4326.
- [ ] Implementar cadastro e listagem simples de universidades.
- [ ] Adaptar o CRUD de `/api/pois` para `/api/paradas`, com validação e respostas 201, 200, 204, 400 e 404 conforme o contrato.
- [ ] Implementar desde a listagem inicial o filtro obrigatório por `bbox`, com consulta PostGIS e índice espacial.
- [ ] Verificar persistência e inclusão/exclusão de pontos dentro e fora do retângulo consultado.

**Sua colega**

- [ ] Adicionar Leaflet e a camada OpenStreetMap com atribuição visível.
- [ ] Iniciar o mapa em Cajazeiras-PB, usando o centro aproximado da referência `[-6.8863, -38.5559]` e zoom 14.
- [ ] Adaptar para React os fluxos da referência: clique no mapa, formulário, seleção, arraste para editar, salvamento e exclusão com confirmação.
- [ ] Criar seleção e cadastro simples de universidade.
- [ ] Solicitar a geolocalização; quando autorizada, centralizar no usuário e mostrar marcador separado. Em caso de falha, manter Cajazeiras e explicar a indisponibilidade.
- [ ] Consultar paradas na abertura e no evento `moveend`, enviando os limites atuais do mapa.
- [ ] Substituir os marcadores pelos resultados atuais, sem duplicações, e descartar respostas de consultas antigas.
- [ ] Mostrar carregamento, erros e ausência de resultados; atualizar o mapa após alterações.

**Concluída quando:** cadastrar, consultar, editar, reposicionar e excluir paradas funciona pela interface e persiste após recarregar. A API retorna apenas os pontos da área solicitada.

### Etapa 3 — Adaptar a busca de localidades

**Você**

- [ ] Implementar `/api/geocodificacao` com provedor configurável e resposta simples de nome e coordenadas.
- [ ] Tratar busca vazia, ausência de resultados, timeout e falhas do provedor.
- [ ] Se usar o Nominatim público, conferir e atender à política vigente de identificação, atribuição, frequência e cache antes da publicação.

**Sua colega**

- [ ] Adaptar o botão de busca da referência para o formulário React, com ação por botão ou Enter.
- [ ] Exibir os resultados e permitir escolher um, centralizando o mapa e movendo o marcador de cadastro.
- [ ] Permitir ajuste manual do ponto antes de salvar a parada e exibir falhas de busca.

**Concluída quando:** é possível procurar um local de Cajazeiras, escolher o resultado, ajustar e salvar. Conferir a [política do Nominatim](https://operations.osmfoundation.org/policies/nominatim/) caso esse seja o provedor adotado.

### Etapa 4 — Acrescentar busca por proximidade

**Você**

- [ ] Implementar consulta parametrizada com posição do usuário, raio em metros e `bbox`.
- [ ] Validar raio positivo e limite máximo no contrato; filtrar com `ST_DWithin`, calcular distância e ordenar os resultados.
- [ ] Criar índice para a consulta em `geography` e verificar pontos dentro, fora e na borda do raio com dados controlados.

**Sua colega**

- [ ] Criar seleção simples de raio, por exemplo, 500 m, 1 km e 2 km.
- [ ] Usar a posição autorizada do usuário como origem, desenhar o círculo e enquadrar a área pesquisada.
- [ ] Mostrar distâncias e permitir limpar o filtro.
- [ ] Ao mover o mapa, preservar origem e raio, atualizando o `bbox` da consulta.
- [ ] Quando não houver geolocalização, explicar a indisponibilidade; não tratar o centro de Cajazeiras como posição real do usuário.

**Concluída quando:** o servidor retorna somente paradas dentro do raio e da área visível, com distâncias em metros.

### Etapa 5 — Completar a temática com ônibus de posição manual

**Você**

- [ ] Criar migração e modelo de ônibus com universidade, ponto opcional e horário da posição.
- [ ] Implementar cadastro, listagem para seleção e listagem de posições por `bbox` com índice espacial.
- [ ] Implementar atualização de posição, salvando ponto e horário do servidor juntos e retornando o estado persistido.

**Sua colega**

- [ ] Criar cadastro simples e seleção de ônibus, indicando os que estão sem posição.
- [ ] Exibir ônibus com marcador diferente das paradas e da posição do usuário.
- [ ] Permitir escolher ou arrastar a posição, com ações de salvar e cancelar.
- [ ] Em caso de falha, manter a última posição confirmada; mostrar horário e indicação de posição informada manualmente.
- [ ] Disponibilizar atualização da consulta para visualizar mudanças salvas por outra pessoa.

**Concluída quando:** salvar altera a posição no banco e em outro navegador após atualizar a consulta; cancelar não altera os dados. Não é necessário tempo real ou animação.

### Etapa 6 — Validar o pacote Docker e publicar

**Você**

- [ ] Integrar o projeto React entregue pela colega ao Dockerfile e verificar `npm ci`, build e cópia dos arquivos para o Express.
- [ ] Executar `docker compose up --build` e validar o acesso ao frontend e à API pela mesma porta do Express.
- [ ] Verificar que as migrações podem ser repetidas com segurança e que os dados persistem após recriar os containers, preservando o volume.
- [ ] Preparar o banco PostGIS na nuvem e executar as migrações, conforme os requisitos de entrega confirmados.
- [ ] Publicar a imagem da aplicação, configurar conexão externa e HTTPS e conferir frontend e API no mesmo endereço.
- [ ] Garantir que erros de API e conexão não exponham credenciais ou detalhes internos.

**Sua colega**

- [ ] Verificar o React compilado servido pelo Express, incluindo carregamento de assets e chamadas relativas a `/api`.
- [ ] Revisar o layout em celular e computador, os controles do mapa e os estados de erro.
- [ ] Verificar geolocalização no endereço HTTPS publicado.

**Dupla**

- [ ] Testar CRUD, geocodificação, filtros espaciais e posição manual no endereço público.
- [ ] Documentar instalação, variáveis, migrações, build, execução local e publicação no README.
- [ ] Confirmar que o build, o Compose e a execução não dependem de `aplicacao-poi/`; então remover a pasta de referência.

**Concluída quando:** uma pessoa consegue iniciar o projeto pelo README e usar a versão publicada, com React servido pelo Express e dados persistidos no PostGIS.

### Etapa 7 — Conferir requisitos e preparar a apresentação

**Dupla**

- [ ] Preparar duas universidades/campi, paradas de demonstração em Cajazeiras e um ônibus com posição manual.
- [ ] Usar coordenadas controladas para demonstrar diferenças entre pontos próximos e distantes da origem da busca.
- [ ] Demonstrar CRUD, busca de endereço, geolocalização, proximidade e carregamento por área visível.
- [ ] Mostrar atualização manual do ônibus e persistência após recarregar ou consultar em outro navegador.
- [ ] Explicar a adaptação da referência: POI → parada, frontend estático → React compilado e listagem completa → consultas espaciais.
- [ ] Explicar Docker, coluna espacial, índices e o caminho navegador → Express → PostGIS.
- [ ] Conferir repositório público, contribuições dos dois integrantes, links de acesso e envio conforme a orientação do professor.
- [ ] Confirmar prazo e formato de apresentação no enunciado vigente.

**Concluída quando:** os dois integrantes conseguem demonstrar e explicar o sistema completo.

## 6. Conferência dos requisitos registrados no plano anterior

Conferir esta lista com o enunciado antes da entrega, pois o documento original da disciplina não está neste repositório.

| Requisito registrado | Onde será atendido | Evidência |
| --- | --- | --- |
| Aplicação web com backend Node.js | Etapas 1, 2 e 6 | React e Express acessíveis no navegador. |
| Frontend e backend publicados | Etapa 6 | Mesmo endereço público, com arquivos React e rotas `/api`. |
| Banco na nuvem | Etapa 6 | Aplicação publicada persistindo no PostGIS externo. |
| CRUD de entidade geográfica | Etapa 2 | Cadastro, leitura, edição e exclusão de parada. |
| Objeto espacial PostGIS | Etapas 1, 2 e 4 | Migrações, coluna `geometry(Point, 4326)` e consultas. |
| Mapa na inserção e leitura | Etapa 2 | Escolha do ponto e exibição de paradas no Leaflet. |
| Geolocalização do navegador | Etapa 2 | Localização autorizada e tratamento de falhas. |
| Geocodificação no cadastro | Etapa 3 | Busca, seleção e ajuste de localidade. |
| Busca por distância do usuário | Etapa 4 | Raio e distâncias em metros calculados no banco. |
| Carregamento pela área visível | Etapa 2 | Requisições com `bbox` e respostas limitadas no servidor. |
| Qualidade da interface | Etapas 2 a 6 | Fluxos claros em celular e computador. |
| Repositório público e Git contínuo | Todas as etapas | Contribuições dos dois integrantes. |
| Domínio da dupla e entrega dos links | Etapa 7 | Demonstração e envio conforme o enunciado. |

Docker e atualização manual de ônibus fazem parte das decisões deste projeto. O banco local em container permite desenvolvimento reproduzível; a publicação com banco na nuvem continua no planejamento até a conferência dos requisitos com o professor.
