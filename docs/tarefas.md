# Tarefas da dupla

Backlog definido na etapa 0 para o repositório `jppgmx/bdii-proj1`. Cada seção corresponde a uma issue, com responsável por função, dependências e critério de aceite. João Paulo é responsável pelo backend e pela infraestrutura; Millena Kelly, pelo frontend. A conta GitHub de Millena Kelly ainda não foi informada para atribuição nas issues.

| Tarefa | Issue | Etapa / responsável |
| --- | --- | --- |
| T01 | [#1](https://github.com/jppgmx/bdii-proj1/issues/1) | 1 — João Paulo / Backend e infraestrutura |
| T02 | [#2](https://github.com/jppgmx/bdii-proj1/issues/2) | 1 — Millena Kelly / Frontend |
| T03 | [#3](https://github.com/jppgmx/bdii-proj1/issues/3) | 2 — João Paulo / Backend |
| T04 | [#4](https://github.com/jppgmx/bdii-proj1/issues/4) | 2 — Millena Kelly / Frontend |
| T05 | [#5](https://github.com/jppgmx/bdii-proj1/issues/5) | 3 — João Paulo / Backend |
| T06 | [#6](https://github.com/jppgmx/bdii-proj1/issues/6) | 3 — Millena Kelly / Frontend |
| T07 | [#7](https://github.com/jppgmx/bdii-proj1/issues/7) | 4 — João Paulo / Backend |
| T08 | [#8](https://github.com/jppgmx/bdii-proj1/issues/8) | 4 — Millena Kelly / Frontend |
| T09 | [#9](https://github.com/jppgmx/bdii-proj1/issues/9) | 5 — João Paulo / Backend |
| T10 | [#10](https://github.com/jppgmx/bdii-proj1/issues/10) | 5 — Millena Kelly / Frontend |
| T11 | [#11](https://github.com/jppgmx/bdii-proj1/issues/11) | 6 — Integração e publicação |
| T12 | [#12](https://github.com/jppgmx/bdii-proj1/issues/12) | 7 — Demonstração e entrega |
| T13 | [#13](https://github.com/jppgmx/bdii-proj1/issues/13) | 0 — Conferência do enunciado |

T09 (ônibus e posição manual) está implementada e validada no backend da `etapa-5`; T07 (proximidade em metros) está implementada no backend da `etapa-4`; T05 (geocodificação Nominatim) está implementada e validada na `etapa-3`; o frontend permanece com Millena Kelly; T03 (universidades e CRUD espacial de paradas) está implementada e validada com PostGIS real na `etapa-2`; T01 tem a base implementada na `etapa-0` e a validação automatizada preparada na `etapa-1`, validada localmente com PostGIS real e Docker. T01 está concluída; T02 continua pendente com Millena Kelly. O [contrato da API](contrato-api.md), o [contrato de integração](integracao.md) e os [dados de demonstração](dados-demonstracao.md) são a base da implementação. Executar uma etapa por vez, em sua branch `etapa-N`.

## T01 — [Etapa 1][Backend] Preparar Express, PostGIS e Docker

**Responsável:** backend e infraestrutura — João Paulo.

**Dependências:** contratos definidos na etapa 0. O build final depende de T02.

- [x] Adaptar Express, conexão Sequelize e organização da referência para `apps/backend/`, sem depender de `aplicacao-poi/`.
- [x] Criar scripts `start` e `dev`, variáveis e `.env.example` conforme `docs/integracao.md`.
- [x] Preparar habilitação de PostGIS no banco local e por migração explícita, sem sincronização ao importar modelos.
- [x] Implementar `/api/health`, verificando conexão inicial e retornando os erros contratados.
- [x] Preparar Dockerfile com build React, dependências de produção e arquivos servidos pelo Express.
- [x] Criar Compose com `app`, `db`, volume e healthcheck, além de `.dockerignore`.
- [x] Documentar execução/migrações e validar testes HTTP, configuração e falha de inicialização.
- [x] Preparar rotina isolada de build/integração (`scripts/validate-stage-1.sh`) e workflow de CI.
- [x] Executar build e integração com PostGIS real: rotina completa aprovada, incluindo saúde e preservação das migrações ao recriar containers.

**Aceite:** backend conecta ao PostGIS local e responde à saúde. Configuração Docker está preparada; não declarar build completo validado sem a entrega React.

## T02 — [Etapa 1][Frontend] Configurar React e integração de desenvolvimento

**Responsável:** frontend — Millena Kelly.

**Dependências:** `docs/integracao.md`; verificação real de saúde depende de T01.

- [ ] Configurar React em `apps/frontend/` e versionar `package-lock.json`.
- [ ] Entregar `npm run dev` na porta 5173 e `npm run build` com saída `dist/`.
- [ ] Configurar proxy de `/api` para `http://localhost:3000`, mantendo chamadas relativas.
- [ ] Criar estrutura visual simples com mapa, painel e formulários.
- [ ] Verificar `/api/health` e apresentar falha de conexão de forma compreensível.

**Aceite:** `npm ci` e build produzem `dist/index.html` e assets; chamadas à API passam pelo proxy. A configuração React permanece com Millena Kelly.

## T03 — [Etapa 2][Backend] Implementar universidades e CRUD espacial de paradas

**Responsável:** backend — João Paulo.

**Dependências:** T01.

- [x] Criar migrações de universidades e paradas, com UUID, chave estrangeira e `geometry(Point, 4326)`.
- [x] Implementar cadastro/listagem de universidades e CRUD de paradas conforme o contrato.
- [x] Exigir `bbox` na listagem e filtrar no banco, incluindo bordas, com índice GiST.
- [x] Validar campos, coordenadas, UUIDs, vínculos e erros JSON.
- [x] Preparar carga de demonstração com as oito instituições/unidades e oito pontos fornecidos, preservando IDs e sem duplicar dados ao repetir a carga.
- [x] Verificar persistência, edição da geometria, exclusão e pontos dentro/fora da área.

**Aceite:** CRUD persiste no PostGIS e os cenários de Cajazeiras/Sousa devolvem os pontos esperados, sem listagem completa quando falta `bbox`.

## T04 — [Etapa 2][Frontend] Integrar Leaflet, geolocalização e CRUD de paradas

**Responsável:** frontend — Millena Kelly.

**Dependências:** T02; integração real depende de T03. Pode começar com mocks do contrato.

- [ ] Adicionar Leaflet/OpenStreetMap com atribuição, centro inicial de Cajazeiras e navegação até Sousa.
- [ ] Tratar geolocalização autorizada, negada, indisponível e expirada, separando usuário e ponto em edição.
- [ ] Implementar cadastro/seleção de universidade e formulário de parada.
- [ ] Adaptar clique, seleção, arraste, salvamento, edição e exclusão com confirmação.
- [ ] Consultar `bbox` na abertura e em `moveend`, substituindo marcadores e descartando respostas antigas.
- [ ] Tratar carregamento, erros e vazio, convertendo a ordem das coordenadas corretamente.

**Aceite:** CRUD funciona pela interface e persiste após recarregar. Mover o mapa altera as consultas espaciais sem duplicar marcadores.

## T05 — [Etapa 3][Backend] Integrar geocodificação com tratamento de falhas

**Responsável:** backend — João Paulo.

**Dependências:** T03.

- [x] Escolher provedor e conferir sua política vigente antes da integração.
- [x] Implementar `/api/geocodificacao`, validação de `q` e até cinco resultados normalizados.
- [x] Configurar identificação, atribuição, frequência, cache e troca de provedor conforme o serviço escolhido.
- [x] Tratar vazio, limites, timeout e indisponibilidade com os erros contratados.

**Aceite:** buscas de locais de Cajazeiras e Sousa retornam nome e ponto estáveis para o frontend; falhas não viram lista vazia.

## T06 — [Etapa 3][Frontend] Adicionar busca e seleção de localidades

**Responsável:** frontend — Millena Kelly.

**Dependências:** T04; integração real depende de T05.

- [ ] Pesquisar por botão ou Enter, codificando a query.
- [ ] Mostrar resultados, vazio e erros e permitir selecionar um local.
- [ ] Centralizar e mover o ponto em edição, permitindo ajuste antes de salvar.
- [ ] Manter a atribuição correspondente ao provedor adotado.

**Aceite:** um resultado de busca pode ser ajustado e salvo como parada, com mensagem compreensível em caso de falha.

## T07 — [Etapa 4][Backend] Consultar paradas por distância em metros

**Responsável:** backend — João Paulo.

**Dependências:** T03; executar após a etapa 3.

- [x] Implementar `/api/paradas/proximas` antes da rota por ID.
- [x] Validar origem, raio de até 50000 m e `bbox` obrigatório.
- [x] Combinar área visível e `ST_DWithin` em `geography`, com índice compatível.
- [x] Retornar `distancia_m` calculada no banco e ordenar por distância e ID.
- [x] Conferir os cenários reais documentados e um ponto controlado exatamente na borda do raio.

**Aceite:** distâncias são calculadas em metros e os dois filtros são aplicados no servidor, incluindo o limite exato.

## T08 — [Etapa 4][Frontend] Integrar raio de busca e distâncias

**Responsável:** frontend — Millena Kelly.

**Dependências:** T04; integração real depende de T07. Executar após a etapa 3.

- [ ] Oferecer raios de 500 m, 1 km e 2 km e ação de limpar filtro.
- [ ] Usar a localização autorizada do usuário; explicar a indisponibilidade quando não houver posição.
- [ ] Desenhar círculo, enquadrar a busca e mostrar distâncias.
- [ ] Preservar origem/raio ao mover o mapa, alterando somente o `bbox` da consulta.

**Aceite:** a interface mostra resultados do raio e da área visível; o centro padrão não substitui a posição do usuário.

## T09 — [Etapa 5][Backend] Persistir ônibus e atualização manual de posição

**Responsável:** backend — João Paulo.

**Dependências:** T03; executar após a etapa 4.

- [x] Criar modelo/migração com universidade, posição opcional, horário e índice espacial.
- [x] Implementar cadastro, listagem do painel e listagem espacial por `bbox`.
- [x] Salvar ponto e horário do servidor juntos na rota de posição e retornar estado persistido.
- [x] Acrescentar `DEMO-01` ao seed, inicialmente sem posição, sem duplicá-lo em novas cargas.
- [x] Verificar listagens sem posição e persistência da atualização.

**Aceite:** o painel inclui ônibus sem posição, o mapa inclui somente posições no retângulo, e uma atualização persiste ponto e horário.

## T10 — [Etapa 5][Frontend] Exibir ônibus e editar posição manualmente

**Responsável:** frontend — Millena Kelly.

**Dependências:** T04; integração real depende de T09. Executar após a etapa 4.

- [ ] Cadastrar e selecionar ônibus, indicando os que estão sem posição.
- [ ] Separar marcadores de ônibus, paradas e usuário.
- [ ] Permitir clique/arraste, salvar e cancelar a posição, sem transmitir em tempo real.
- [ ] Manter estado confirmado se a gravação falhar e mostrar horário local da última posição manual.
- [ ] Permitir atualizar a consulta para visualizar alterações de outra sessão.

**Aceite:** cancelar não grava; salvar persiste e outra sessão vê a alteração ao atualizar a consulta.

## T11 — [Etapa 6][Integração] Validar Docker e publicar React com Express

**Responsáveis:** João Paulo e Millena Kelly; backend cuida de infraestrutura e publicação, frontend valida o build e a interface.

**Dependências:** T01 a T10; condições externas de publicação devem ser confirmadas em T13.

- [ ] Validar instalação/build do React e cópia para `apps/backend/public/` na imagem final.
- [ ] Executar `docker compose up --build` e conferir frontend/API pela porta do Express, sem servidor React separado.
- [ ] Verificar migrações repetíveis, recriação de containers e persistência do volume.
- [ ] Publicar aplicação e banco PostGIS conforme o enunciado confirmado, com ambiente e HTTPS.
- [ ] Testar assets, erros JSON de API, geolocalização, CRUD, geocodificação, proximidade e ônibus no endereço público.
- [ ] Revisar celular/computador e documentar instalação, execução e publicação no README.
- [ ] Remover `aplicacao-poi/` somente após comprovar que build e execução independem dela.

**Aceite:** projeto pode ser iniciado pelo README e acessado publicamente, com React servido pelo Express e dados persistidos.

## T12 — [Etapa 7][Integração] Preparar demonstração e entrega da disciplina

**Responsáveis:** João Paulo e Millena Kelly.

**Dependências:** T11 e confirmação de prazo/formato em T13.

- [ ] Preparar os oito locais fornecidos e um ônibus de demonstração sem confundir coordenadas de instituições com paradas oficiais.
- [ ] Demonstrar CRUD, geolocalização, geocodificação, distância, área visível e posição manual persistida.
- [ ] Ambos explicarem adaptação da referência, React/Express, Docker, coluna espacial e índices.
- [ ] Conferir contribuições dos dois integrantes, links e entrega conforme o enunciado.

**Aceite:** os dois conseguem demonstrar e explicar o sistema e entregar os links no formato e prazo confirmados.

## T13 — [Etapa 0][Integração] Conferir enunciado e requisitos externos

**Responsáveis:** João Paulo e Millena Kelly.

**Dependências:** acesso ao enunciado oficial ou confirmação do professor. O arquivo citado no plano anterior não está no repositório.

- [ ] Disponibilizar ou consultar o enunciado vigente da disciplina.
- [ ] Confirmar se frontend/backend publicados no mesmo endereço atendem à exigência.
- [ ] Confirmar exigência de banco na nuvem e eventuais restrições de hospedagem.
- [ ] Registrar prazo válido, apresentação e forma de envio, com referência à fonte.
- [ ] Atualizar a conferência de requisitos do plano; registrar diferenças antes da publicação.

**Aceite:** requisitos externos e calendário estão documentados a partir da fonte oficial. Esta pendência não impede o início do backend local na etapa 1.
