# Contrato da API — versão 1

Contrato definido na etapa 0 para orientar a implementação do Express e a integração do React. `GET /api/health`, universidades e CRUD espacial de paradas estão implementados até a branch `etapa-2`; geocodificação está implementada na `etapa-3`, proximidade está implementada na `etapa-4`, e ônibus/posição manual estão implementados na `etapa-5`. Exemplos usam os locais fornecidos pelo usuário e horários ilustrativos.

## Convenções gerais

- Prefixo `/api`; requisições e respostas com corpo usam `application/json`.
- Listagens retornam arrays, inclusive `[]` quando não há resultados, sem envelope ou paginação nesta versão.
- Identificadores são UUIDs. A API gera os IDs na criação; o cliente não envia `id`, `createdAt` ou `updatedAt`.
- `createdAt` e `updatedAt` são datas ISO 8601 em UTC, geradas pelo servidor. O React formata os horários para exibição local.
- Campos de texto são aparados nas extremidades. Campo obrigatório vazio após essa operação é inválido.
- Campos desconhecidos no corpo são rejeitados com 400. JSON malformado, tipos incorretos, UUID inválido e referência a universidade inexistente também retornam 400.
- Omitir campo opcional na criação aplica seu valor padrão. `PUT` substitui os campos editáveis da parada e exige todos os obrigatórios; omitir `descricao` limpa seu valor para `null`.
- Não há autenticação nesta versão. Não expor dados pessoais nos cadastros de demonstração.
- Listagens textuais são ordenadas por `nome` ou `identificacao` e depois `id`. Proximidade ordena por distância crescente e depois `id`.

### Coordenadas e área visível

O corpo de um ponto segue GeoJSON, com exatamente duas coordenadas numéricas finitas e SRID 4326 implícito:

```json
{
  "type": "Point",
  "coordinates": [-38.54534133432616, -6.889266108880796]
}
```

A ordem é `[longitude, latitude]`. As coordenadas fornecidas pelo usuário e as usadas em `L.marker` estão em `[latitude, longitude]`; o frontend faz a conversão. Longitude deve estar entre -180 e 180, latitude entre -90 e 90. Não aceitar strings ou `null` no array. O mapa começa em Cajazeiras, mas o cadastro e os filtros também permitem os locais de Sousa.

`bbox=west,south,east,north` contém quatro números finitos em graus, separados por vírgulas. É obrigatório nas listagens de marcadores, com `west < east`, `south < north` e os mesmos limites de longitude/latitude. Nesta versão não são aceitos retângulos que cruzem o antimeridiano. Incluir pontos na borda do retângulo. Consultar e filtrar no PostGIS.

Exemplo para os cinco locais de Cajazeiras: `bbox=-38.58,-6.91,-38.53,-6.86`. Exemplo que também inclui os três locais de Sousa: `bbox=-38.58,-6.91,-38.22,-6.77`.

### Erros

Formato único, inclusive para rota `/api` inexistente. `fields` aparece apenas em erros de validação; suas chaves são os nomes dos campos inválidos.

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Dados inválidos.",
    "fields": {
      "bbox": "Informe west,south,east,north com limites válidos."
    }
  }
}
```

| HTTP | `error.code` | Situação |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Corpo, parâmetro ou referência inválida. |
| 400 | `INVALID_JSON` | Corpo não é JSON válido. |
| 404 | `NOT_FOUND` | UUID válido não cadastrado ou rota `/api` inexistente. |
| 413 | `PAYLOAD_TOO_LARGE` | Corpo JSON excede 100 KB. |
| 429 | `RATE_LIMITED` | Limite local da busca de localidades atingido; enviar `Retry-After` em segundos. |
| 502 | `GEOCODING_UNAVAILABLE` | Falha ou resposta inválida do provedor de localidades. |
| 503 | `DATABASE_UNAVAILABLE` | Banco indisponível, inclusive na verificação de saúde. |
| 504 | `GEOCODING_TIMEOUT` | Provedor de localidades excedeu o tempo de espera. |
| 500 | `INTERNAL_ERROR` | Falha inesperada; mensagem genérica, sem SQL, stack ou credenciais. |

Exemplo de recurso inexistente:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Parada não encontrada."
  }
}
```

## Saúde — etapa 1

### `GET /api/health`

Sem corpo ou parâmetros. Verifica também a conexão com o banco. Resposta 200:

```json
{
  "status": "ok",
  "database": "ok"
}
```

Quando o processo estiver respondendo, mas o banco estiver indisponível, retorna 503 no formato de erro com código `DATABASE_UNAVAILABLE`. A inicialização do servidor deve aguardar a conexão inicial com o banco.

## Universidades — etapa 2

O recurso também representa faculdades e institutos. Cada registro identifica uma instituição/campus; portanto, a mesma sigla pode aparecer em Cajazeiras, Sousa e São Gonçalo. Não impor unicidade à sigla.

| Campo de entrada | Tipo | Regra |
| --- | --- | --- |
| `nome` | string | Obrigatório, de 1 a 160 caracteres. |
| `sigla` | string ou `null` | Opcional, de 1 a 20 caracteres quando informada; padrão `null`. |
| `campus` | string ou `null` | Opcional, de 1 a 120 caracteres quando informado; padrão `null`. |

### `POST /api/universidades`

Corpo:

```json
{
  "nome": "Instituto Federal de Educação, Ciência e Tecnologia do Sertão Paraibano",
  "sigla": "IFSertãoPB",
  "campus": "Cajazeiras"
}
```

Resposta 201:

```json
{
  "id": "10000000-0000-4000-8000-000000000001",
  "nome": "Instituto Federal de Educação, Ciência e Tecnologia do Sertão Paraibano",
  "sigla": "IFSertãoPB",
  "campus": "Cajazeiras",
  "createdAt": "2026-11-09T12:00:00.000Z",
  "updatedAt": "2026-11-09T12:00:00.000Z"
}
```

### `GET /api/universidades`

Sem corpo. Resposta 200: array de objetos completos no formato acima; por exemplo, `[objeto da universidade]`. Sem registros, retorna `[]`. Não exige `bbox`: alimenta seletores, inclusive para instituições fora da área atual do mapa.

## Paradas — etapa 2

| Campo de entrada | Tipo | Regra |
| --- | --- | --- |
| `nome` | string | Obrigatório, de 1 a 120 caracteres. |
| `descricao` | string ou `null` | Opcional, até 500 caracteres; omitida, vazia ou só com espaços vira `null`. |
| `universidade_id` | string UUID | Obrigatório; deve existir. |
| `localizacao` | objeto Point | Obrigatório e válido conforme as convenções espaciais. |

### `POST /api/paradas`

Corpo:

```json
{
  "nome": "Ponto de demonstração — IFSertãoPB Cajazeiras",
  "descricao": "Local fornecido pelo usuário; não representa uma parada oficial confirmada.",
  "universidade_id": "10000000-0000-4000-8000-000000000001",
  "localizacao": {
    "type": "Point",
    "coordinates": [-38.54534133432616, -6.889266108880796]
  }
}
```

Resposta 201:

```json
{
  "id": "20000000-0000-4000-8000-000000000001",
  "nome": "Ponto de demonstração — IFSertãoPB Cajazeiras",
  "descricao": "Local fornecido pelo usuário; não representa uma parada oficial confirmada.",
  "universidade_id": "10000000-0000-4000-8000-000000000001",
  "localizacao": {
    "type": "Point",
    "coordinates": [-38.54534133432616, -6.889266108880796]
  },
  "createdAt": "2026-11-09T12:00:00.000Z",
  "updatedAt": "2026-11-09T12:00:00.000Z"
}
```

### `GET /api/paradas?bbox=-38.58,-6.91,-38.53,-6.86`

Resposta 200: array de paradas completas no formato acima, filtradas pelo retângulo. Sem resultados, `[]`. `bbox` ausente ou inválido retorna 400; nunca recorrer a uma listagem completa.

### `GET /api/paradas/:id`

Resposta 200: objeto completo da parada, como na criação. Não exige `bbox`. UUID inválido retorna 400; UUID válido não encontrado retorna 404.

### `PUT /api/paradas/:id`

Corpo com o mesmo formato e os mesmos campos obrigatórios do `POST`. Substitui nome, descrição, vínculo e localização; preserva `id` e `createdAt` e atualiza `updatedAt`.

Exemplo para alterar somente a descrição na interface: enviar também os valores atuais de nome, universidade e localização, com `descricao: "Embarque de demonstração"`. Resposta 200: objeto completo já atualizado. Dados inválidos retornam 400; parada inexistente retorna 404. Não usar `PUT` como criação.

### `DELETE /api/paradas/:id`

Sem corpo. Resposta 204, sem corpo, ao excluir. UUID inválido retorna 400; parada inexistente retorna 404. O frontend não deve tentar interpretar JSON na resposta 204.

## Geocodificação — etapa 3

### `GET /api/geocodificacao?q=IFSert%C3%A3oPB%20Cajazeiras`

`q` obrigatório, texto com 3 a 200 caracteres após aparar espaços. O frontend codifica a query, por exemplo, com `URLSearchParams`. Busca explícita por botão ou Enter. A consulta pode incluir Sousa; não limitar o provedor à área visível do mapa.

Resposta 200, com até cinco resultados normalizados. O conteúdo depende do provedor; este exemplo é ilustrativo:

```json
[
  {
    "nome": "IFSertãoPB, Cajazeiras, Paraíba, Brasil",
    "localizacao": {
      "type": "Point",
      "coordinates": [-38.54534133432616, -6.889266108880796]
    }
  }
]
```

Sem resultados retorna `[]`. Query inválida retorna 400. O frontend mantém a atribuição do provedor configurado, definida no [contrato de integração](integracao.md). Retornos 429, 502 e 504 seguem a tabela de erros; uma falha não deve ser convertida em lista vazia. Na etapa 3 foi adotado Nominatim com `format=jsonv2`, `limit=5` e idioma `pt-BR`, sem filtro de área visível. O backend envia User-Agent de identificação e devolve o link de licença no header `Link`. Cache persistente por 24 horas, com até 1000 consultas, e controle global de uma chamada por segundo ficam no PostgreSQL. Consultas concorrentes sem cache e intervalo ativo retornam 429; um limite recebido do provedor também retorna 429 e bloqueia novas chamadas conforme `Retry-After` (até 24 horas; 60 segundos se ausente). Falhas não são armazenadas como resultados vazios. O endpoint pode ser trocado por configuração para outro serviço compatível com Nominatim.

## Proximidade — etapa 4

### `GET /api/paradas/proximas?lat=-6.889266108880796&lng=-38.54534133432616&raio_m=2000&bbox=-38.58,-6.91,-38.53,-6.86`

| Parâmetro | Regra |
| --- | --- |
| `lat` e `lng` | Obrigatórios, números finitos na faixa válida de latitude e longitude. |
| `raio_m` | Obrigatório, número finito maior que zero e menor ou igual a 50000, em metros. |
| `bbox` | Obrigatório, conforme as convenções espaciais. |

Números na query chegam como texto e devem ser convertidos de forma estrita, sem aceitar vazio ou sufixos como `2000m`. Combinar os filtros: o ponto precisa estar dentro do raio **e** da área visível. Incluir pontos na distância limite. A origem permanece a localização do usuário ao movimentar o mapa.

Resposta 200: array de paradas completas, acrescidas de `distancia_m` numérica e não negativa, ordenadas por distância crescente e depois `id`. O cálculo e a filtragem acontecem no PostGIS; a interface pode arredondar apenas para exibir.

Exemplo de resultado no próprio ponto de origem:

```json
[
  {
    "id": "20000000-0000-4000-8000-000000000001",
    "nome": "Ponto de demonstração — IFSertãoPB Cajazeiras",
    "descricao": "Local fornecido pelo usuário; não representa uma parada oficial confirmada.",
    "universidade_id": "10000000-0000-4000-8000-000000000001",
    "localizacao": {
      "type": "Point",
      "coordinates": [-38.54534133432616, -6.889266108880796]
    },
    "createdAt": "2026-11-09T12:00:00.000Z",
    "updatedAt": "2026-11-09T12:00:00.000Z",
    "distancia_m": 0
  }
]
```

O exemplo ilustra um item, não a lista completa esperada dos oito locais. Sem resultados, `[]`; parâmetros ausentes ou inválidos retornam 400. A rota está registrada antes de `/api/paradas/:id`. A migração `004-paradas-geography-index.js` adiciona o índice GiST sobre `localizacao::geography`; a consulta usa essa mesma expressão para filtrar com `ST_DWithin` e calcular `distancia_m` com `ST_Distance`, mantendo o cálculo padrão no esferoide. Parâmetros numéricos repetidos são inválidos.

## Ônibus — etapa 5

| Campo de cadastro | Tipo | Regra |
| --- | --- | --- |
| `identificacao` | string | Obrigatório, de 1 a 60 caracteres; identificação de demonstração, sem dados pessoais. |
| `universidade_id` | string UUID | Obrigatório; deve existir. |

### `POST /api/onibus`

Corpo:

```json
{
  "identificacao": "DEMO-01",
  "universidade_id": "10000000-0000-4000-8000-000000000001"
}
```

Resposta 201:

```json
{
  "id": "30000000-0000-4000-8000-000000000001",
  "identificacao": "DEMO-01",
  "universidade_id": "10000000-0000-4000-8000-000000000001",
  "posicao_atual": null,
  "posicao_atualizada_em": null,
  "createdAt": "2026-11-09T12:00:00.000Z",
  "updatedAt": "2026-11-09T12:00:00.000Z"
}
```

O cadastro começa sem posição. Para posicionar, usar a rota específica de atualização. Não aceitar posição ou horário no corpo do cadastro.

### `GET /api/onibus`

Sem parâmetros obrigatórios. Resposta 200: array de objetos completos de ônibus no formato acima, inclusive posições quando existentes. Esta listagem alimenta o seletor do painel e inclui os ônibus sem posição; não usá-la como fonte dos marcadores do mapa. Sem registros, `[]`.

### `PATCH /api/onibus/:id/posicao`

Corpo:

```json
{
  "posicao_atual": {
    "type": "Point",
    "coordinates": [-38.54534133432616, -6.889266108880796]
  }
}
```

O ponto é obrigatório; `null` não limpa a posição nesta versão. Salvar ponto e horário do servidor na mesma atualização. O cliente não envia horário. Resposta 200:

```json
{
  "id": "30000000-0000-4000-8000-000000000001",
  "identificacao": "DEMO-01",
  "universidade_id": "10000000-0000-4000-8000-000000000001",
  "posicao_atual": {
    "type": "Point",
    "coordinates": [-38.54534133432616, -6.889266108880796]
  },
  "posicao_atualizada_em": "2026-11-09T12:05:00.000Z",
  "createdAt": "2026-11-09T12:00:00.000Z",
  "updatedAt": "2026-11-09T12:05:00.000Z"
}
```

Dados inválidos retornam 400; ônibus inexistente retorna 404. Se houver duas atualizações, vale a última gravação; não há sincronização em tempo real nesta versão. Cancelar na interface não envia a requisição.

### `GET /api/onibus/posicoes?bbox=-38.58,-6.91,-38.53,-6.86`

Resposta 200: array de objetos completos de ônibus, como na resposta da atualização, com ponto não nulo dentro do retângulo. Ônibus sem posição são omitidos desta rota. Sem resultados retorna `[]`; `bbox` ausente ou inválido retorna 400.

## Dados para integração

Os oito locais, IDs estáveis de demonstração e cenários estão em [dados-demonstracao.md](dados-demonstracao.md) e [dados-demonstracao.json](dados-demonstracao.json). O JSON alimenta a carga opcional `npm run db:seed` e os mocks: não é uma resposta completa da API, pois não contém datas geradas pelo servidor. Usar os exemplos deste contrato ao simular respostas no React.

Mudanças no contrato devem atualizar este documento e a tarefa correspondente antes da integração. A configuração do React permanece com Millena Kelly; geocodificação já está implementada no backend e proximidade está implementada no backend e as rotas de ônibus/posição manual também estão implementadas; a integração visual permanece com Millena Kelly.
