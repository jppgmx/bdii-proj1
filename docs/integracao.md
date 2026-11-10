# Contrato de integração — React, Express e Docker

Convenções definidas na etapa 0. A colega configura o React; o responsável pelo backend prepara o Express e os arquivos Docker na etapa 1.

## Diretórios e comandos

| Item | Convenção |
| --- | --- |
| Backend | `apps/backend/`, Express com Sequelize e `pg`, módulos ES. |
| Runtime | Node.js 26, também utilizado nos estágios do Dockerfile. |
| Frontend | `apps/frontend/`, React com Leaflet. A ferramenta de build fica a cargo da colega. |
| Dependências | npm em cada projeto, com `package-lock.json` versionado e instalação por `npm ci`. Sem workspace npm nesta versão. |
| Backend em produção | `npm start`, executado em `apps/backend/`. |
| Backend em desenvolvimento | `npm run dev`, executado em `apps/backend/`. |
| Frontend em desenvolvimento | `npm run dev`, executado em `apps/frontend/`. |
| Build do frontend | `npm run build`, executado em `apps/frontend/`. |
| Saída do build | `apps/frontend/dist/`, contendo `index.html` e assets. |
| Destino na imagem | `apps/backend/public/`. |
| Porta Express | `API_PORT`, padrão `3000`; Compose expõe `3000:3000`. |
| Servidor React local | Porta `5173`, com proxy de `/api` para `http://localhost:3000`. |
| Banco local | Serviço `db` no Compose, porta interna `5432`, volume persistente. |

O projeto React deverá cumprir o contrato de comando e saída mesmo se usar outra ferramenta de build. Se alguma convenção precisar mudar, atualizar este documento e o Dockerfile juntos. O build completo só será verificado quando o React estiver entregue; não criar uma configuração substituta no lugar da colega.

## Caminho das requisições

Em desenvolvimento, o navegador abre o servidor React na porta 5173 e chama `/api/...`. O proxy encaminha para o Express em `localhost:3000`. O cliente não recebe credenciais de banco nem configura um host de banco.

Em produção, o navegador abre o Express. O mesmo processo entrega o build do React e responde a `/api/...`. Não haverá container de servidor React nem publicação separada do frontend.

O Dockerfile usa a raiz como contexto, compila o React em um estágio de build e copia somente o resultado e o backend com dependências de produção para a imagem final. O Compose inicia essa imagem como `app`, conectada a `db` no ambiente local. A aplicação deve escutar em `0.0.0.0` no container. Migrações devem estar concluídas antes de considerar a aplicação pronta.

O Dockerfile já está preparado com alvo `backend` para rodar antes da entrega do React e alvo `production` para compilar e integrar o frontend. O Compose usa `APP_BUILD_TARGET=backend` por padrão; depois da entrega, definir `APP_BUILD_TARGET=production`. `API_PORT` no `.env` controla a porta publicada, enquanto a porta interna do Express no Compose é sempre 3000. O PostgreSQL é publicado apenas em `127.0.0.1` para desenvolvimento local.

No Express, registrar rotas e erros JSON de `/api` antes de servir o frontend. Uma rota de API desconhecida retorna 404 JSON. Se a interface precisar de rotas de navegação, o fallback de `index.html` não deve interceptar `/api` nem devolver HTML para um asset ausente.

## Variáveis previstas para a etapa 1

| Variável | Finalidade |
| --- | --- |
| `NODE_ENV` | `development` localmente ou `production` na imagem final. |
| `API_PORT` | Porta em que o Express escuta, padrão 3000. |
| `PG_HOST` | `db` dentro do Compose; host externo na publicação. |
| `PG_PORT` | Porta do PostgreSQL, padrão 5432. |
| `PG_DATABASE` | Nome do banco. |
| `PG_USER` | Usuário do banco. |
| `PG_PASSWORD` | Senha configurada no ambiente, sem credencial real no repositório. |
| `PG_SSL` | `false` no banco local; `true` quando exigido pelo provedor. Não desabilitar verificação de certificado. |
| `APP_BUILD_TARGET` | `backend` enquanto o React não foi entregue; `production` para integrar seu build. |

Não há variável de URL de API obrigatória no React: as chamadas são relativas a `/api`. Configurações de geocodificação serão definidas na etapa 3 conforme o provedor escolhido. Nenhuma variável secreta deve ser incorporada no build do frontend.

## Mapa e interação

- Região inicial: Cajazeiras-PB, centro Leaflet `[-6.8863, -38.5559]`, zoom 14.
- O mapa permite navegar até Sousa; não impor limites que excluam as três unidades fornecidas pelo usuário.
- A geolocalização autorizada centraliza no usuário. Se falhar, manter a região inicial e explicar; a posição inicial não é uma localização obtida do navegador.
- Separar os marcadores de usuário, paradas, ônibus e ponto em edição. Cancelar uma edição restaura o estado persistido.
- Na abertura e em `moveend`, ler `getBounds()` e enviar `west,south,east,north` como `bbox`. Substituir os resultados e descartar respostas antigas.
- O raio usa a posição real autorizada do usuário, mantém essa origem ao mover o mapa e consulta raio e área visível juntos.
- Mostrar datas da API em horário local, sem alterar o valor UTC persistido.

## Provedores e atribuição

A camada prevista é OpenStreetMap. Manter visível a atribuição com link para os contribuidores: `© OpenStreetMap contributors`. Na etapa de implementação, conferir as condições do serviço de tiles escolhido.

Nominatim é o candidato inicial à geocodificação. Se for adotado, o frontend mantém a atribuição de dados OpenStreetMap e o backend controla as chamadas conforme a política vigente. Se o provedor mudar, atualizar atribuição e configuração antes da integração. A busca será explícita por botão ou Enter.

## Aceite da integração

1. A colega entrega `package.json`, lockfile e código do frontend; `npm ci` e `npm run build` produzem `dist/index.html` e assets.
2. O responsável pelo backend confirma que os arquivos são copiados para `public/` e servidos pelo Express.
3. No desenvolvimento, chamadas a `/api/health` passam pelo proxy do React.
4. Na imagem final, frontend e API funcionam na porta 3000, sem servidor React separado.
5. Uma API inexistente retorna JSON 404; geolocalização, carregamento do mapa e persistência são verificados nos ambientes correspondentes.

As verificações acima pertencem às etapas 1 e 6. A base Express/PostGIS, as migrações e os arquivos Docker estão implementados. Os testes HTTP usam banco simulado; a integração real e o build das imagens ainda precisam ser executados em um ambiente com acesso ao Docker. O React permanece a cargo da colega.

## Dependências

O backend usa um override restrito do `uuid` transitivo do Sequelize para a versão 11.1.1, que corrige o [alerta GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq). A compatibilidade da geração de UUID v4 pelo Sequelize é verificada na suíte local. A auditoria da instalação atual não apontou vulnerabilidades.

Referências usadas para os arquivos de execução: [linha Node.js 26](https://github.com/nodejs/Release), [imagem PostGIS 17-3.6](https://github.com/postgis/docker-postgis) e [espera por serviço saudável no Compose](https://docs.docker.com/compose/how-tos/startup-order/).
