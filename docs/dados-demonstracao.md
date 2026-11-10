# Dados de demonstração — Cajazeiras e Sousa

Os nomes de referência e as coordenadas abaixo foram fornecidos pelo usuário para locais reais. As denominações institucionais foram mantidas conforme a informação recebida, com correção apenas do erro de digitação “Federeal” para “Federal”; não houve validação cadastral externa.

Esses locais serão usados para criar **pontos de demonstração vinculados às instituições**. Uma coordenada de instituição não confirma um ponto oficial de embarque ou desembarque. Os nomes das paradas e o ônibus `DEMO-01` são dados de demonstração.

## Locais definidos

| Nº | Instituição / unidade | Latitude fornecida | Longitude fornecida |
| --- | --- | --- | --- |
| 1 | Instituto Federal de Educação, Ciência e Tecnologia do Sertão Paraibano (IFSertãoPB) — Cajazeiras | -6.889266108880796 | -38.54534133432616 |
| 2 | Universidade Federal de Campina Grande (UFCG) — Cajazeiras | -6.873302617195168 | -38.559004991996964 |
| 3 | Faculdade São Francisco da Paraíba (FASP) — Cajazeiras | -6.873510720708899 | -38.542107359470364 |
| 4 | Faculdade Católica da Paraíba (FAFIC) — Cajazeiras | -6.883182320508749 | -38.56280293432631 |
| 5 | Faculdade Santa Maria (UNIFSM) — Cajazeiras | -6.898852476927565 | -38.548557090151256 |
| 6 | UFCG — Sousa | -6.782534424138256 | -38.259559676174476 |
| 7 | IFSertãoPB — Unidade Sousa | -6.779663055546379 | -38.23064594413226 |
| 8 | IFSertãoPB — Unidade São Gonçalo, em Sousa | -6.839964058520175 | -38.29433560364672 |

São oito registros no recurso `universidades`, um para cada instituição/campus. UFCG e IFSertãoPB podem repetir a sigla, pois representam unidades diferentes. O campo `campus` distingue Cajazeiras, Sousa e São Gonçalo (Sousa).

## Arquivo reutilizável

[dados-demonstracao.json](dados-demonstracao.json) contém oito universidades, oito pontos de demonstração e um ônibus inicialmente sem posição. A ordem corresponde à tabela acima.

- IDs de universidades: `10000000-0000-4000-8000-000000000001` a `10000000-0000-4000-8000-000000000008`.
- IDs de pontos: `20000000-0000-4000-8000-000000000001` a `20000000-0000-4000-8000-000000000008`, vinculados às respectivas universidades.
- Ônibus `DEMO-01`: `30000000-0000-4000-8000-000000000001`, vinculado à unidade 1.
- Pontos estão em GeoJSON, com `[longitude, latitude]`; não inverter novamente ao salvar no PostGIS.
- O arquivo alimenta a carga opcional `npm run db:seed` e os mocks. Na etapa 2, a carga das universidades e paradas foi validada com PostGIS real, incluindo repetição sem duplicar IDs. O ônibus será carregado na etapa 5.
- Seeds poderão preservar os IDs estáveis para evitar duplicações ao repetir a carga; chamadas públicas de criação devem omitir os IDs.
- Datas serão geradas na carga ou simuladas no mock conforme o [contrato da API](contrato-api.md). O ônibus começa com posição e horário nulos.

## Cenários para validar nas próximas etapas

| Cenário | Entrada | Resultado esperado após carregar o conjunto |
| --- | --- | --- |
| Área de Cajazeiras | `bbox=-38.58,-6.91,-38.53,-6.86` | Exatamente os pontos 1 a 5. |
| Área das duas cidades | `bbox=-38.58,-6.91,-38.22,-6.77` | Todos os oito pontos. |
| Área de Sousa | `bbox=-38.31,-6.85,-38.22,-6.77` | Exatamente os pontos 6 a 8. |
| Área vazia | `bbox=-38.52,-6.91,-38.50,-6.89` | Nenhum ponto. |
| Raio de 500 m na unidade 1 | Origem `lat=-6.889266108880796&lng=-38.54534133432616`, área de Cajazeiras | Somente o ponto 1, com distância zero. |
| Raio de 2 km na unidade 1 | Mesma origem e área de Cajazeiras | Pontos 1, 5 e 3, nessa ordem de distância crescente. |
| Raio de 5 km na unidade 1 | Mesma origem e área das duas cidades | Pontos 1 a 5; unidades de Sousa ficam fora do raio. |
| Ônibus sem posição | Listagem do painel e posições por área | `DEMO-01` aparece no painel, mas não como marcador. |
| Posição manual | Atualizar `DEMO-01` para a coordenada da unidade 1 | Ponto e horário persistem; o marcador aparece na área de Cajazeiras. |

A origem da busca por raio acima é uma **localização simulada para demonstração**. Na aplicação normal, usar a posição autorizada pelo navegador; não substituir a posição real do usuário pela coordenada de uma instituição.

Esses cenários dependem somente deste conjunto, sem cadastros extras. Os resultados por raio serão conferidos com PostGIS na etapa 4. Para testar exatamente a borda do raio, construir um ponto controlado no banco nessa etapa; as coordenadas reais não devem ser alteradas para forçar esse caso.
