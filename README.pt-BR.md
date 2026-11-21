> 语言 / Language: [简体中文](README.md) · [English](README.en.md) · [日本語](README.ja.md) · [Русский](README.ru.md) · [Español](README.es.md) · [Português (BR)](README.pt-BR.md)

# Twisty Atlas — Atlas de Algoritmos de Cubos Mágicos

Biblioteca de algoritmos para múltiplos tipos de cubos mágicos + player de movimentos **3D real** + **cronômetro estilo csTimer**.
Algoritmos, destaque de etapas e imagens 3D rigorosamente sincronizados; **37 conjuntos de algoritmos embutidos (2433 casos / 13667 algoritmos)**;
os dados ficam no dispositivo local e podem ser usados offline. As versões desktop e Android têm formas de interação independentes (não é a mesma página redimensionada).

Não é uma imagem conceitual nem um vídeo: o cubo/tetraedro/dodecaedro é renderizado em tempo real por WebGL, e cada giro de camada é calculado pelo modelo de estado do `cubing.js`. Os testes verificam a correção pelo estado do motor, não por capturas de tela.

---

## Recursos

### Player 3D
- **Reprodução 3D real**: 3x3, 2x2 a 7x7, pirâmide (Pyraminx), skewb e megaminx, totalizando 9 tipos, são 3D reais;
  Square-1 usa renderização 2D (limitação do motor, indicada honestamente).
- **Reprodução passo a passo do algoritmo**: contador 0 / N passos, barra de progresso arrastável, passo anterior/próximo, ir para o início/fim, velocidade variável de 0,5× a 2×.
  Clicar no passo k sempre para na imagem do final do passo k (o posicionamento é baseado na linha do tempo do motor, não em um temporizador).
- **Três estados iniciais**: começar do estado resolvido / usar o algoritmo invertido como estado inicial / setup personalizado (para casos como OLL, PLL, F2L).
- **Face inferior de demonstração opcional**: amarela (padrão) / branca / azul / verde / vermelha / laranja. A abordagem não é "girar a câmera",
  mas sim aplicar uma conjugação `R·A·R⁻¹` ao algoritmo e ao estado inicial juntos; o estado final continua sendo o resolvido, apenas com uma orientação geral diferente.
  A escolha é persistida e, ao alternar, o algoritmo atual é recarregado imediatamente.
- **Câmera e ângulo de visão**: arraste para girar, roda do mouse para zoom, um clique para redefinir. **Mover a câmera não altera o estado do cubo** (há um caso de teste específico).

### Conjuntos de algoritmos embutidos (37 conjuntos / 2433 casos / 13667 algoritmos)
| Categoria | Conteúdo |
|---|---|
| 3x3 · linha principal CFOP | OLL 57, PLL 21, 2-Look OLL 10, 2-Look PLL 6, F2L 41 |
| 3x3 · sistema avançado | COLL 40, WV 26, ZBLL/1LLL 472, **VLS 189**, ZBLS 291, OLLCP 342, CLS 97, SBLS 65, SV 27, CMLL 42, ELL 25, Advanced F2L 54, Pseudo F2L 33 |
| 2x2 | CLL 42, EG-1 40, EG-2 40, Ortega OLL 7, Ortega PBL 9 |
| 4x4 / 5x5 | 4×4 OLL Parity 9, 4×4 PLL Parity 52, 5×5 L2E 31 |
| Pirâmide / Megaminx / SQ-1 | Pirâmide L4E 49; Megaminx CO/CP/EO/EP/PLL 16/15/3/5/151; SQ-1 CO/CP/EO/EP/Parity 7/8/7/99/5 |

Cada algoritmo passou por validação estrutural com o KPuzzle real (9357 passaram na validação completa de estado, 4310 passaram na validação de sintaxe + analisabilidade);
o painel de detalhes mostra a origem e o nível de validação. Os 399 algoritmos rejeitados estão registrados em `data/verified/rejected.json`.
Os detalhes estão em [`docs/DATA_SOURCES.md`](docs/DATA_SOURCES.md).

### Cronômetro (estilo csTimer)
- Barra de embaralhamento no topo (estado aleatório real da WCA) + trocar por outro (`N`); o texto do embaralhamento quebra linha por completo no celular, sem truncamento.
- Segure a barra de espaço (ou a área do número grande) por ≥ 300 ms até ficar verde → solte para iniciar; pressione novamente para parar.
- Inspeção WCA: iniciar em até 15 s, `+2` entre 15–17 s, `DNF` acima de 17 s (pode ser desativado).
- Estatísticas: atual / melhor / pior / média / mo3 / ao5 / ao12 / **ao50 / ao100** / melhor ao5 / ao12 / ao50;
  média sem o melhor e o pior tempo, regras de DNF corretas.
- **Tempos editáveis individualmente**: clique em `+2` / `DNF` para alternar a penalidade, clique para excluir um registro; a tecla `Delete` exclui o último registro; limpar a sessão.
- **Exportação**: CSV (pode ser aberto diretamente no Excel, com penalidades, embaralhamentos e carimbos de data/hora) / JSON (todos os campos) / texto simples (tabela alinhada).
- Coluna direita: prévia real com `TwistyPlayer` de "como é este embaralhamento" (não é uma imagem).
- O display de sete segmentos é feito apenas com polígonos SVG (traços oblíquos + `skewX(-6)`), sem dependência de fontes; a largura se adapta automaticamente,
  reduzindo de tamanho quando o cronômetro chega a números longos como `1:23.456`, sem cortes em telas estreitas.

### Gerenciamento da biblioteca de algoritmos
- Busca (título/algoritmo/etiquetas), filtro por categoria e etiquetas, favoritos, ordenação, criar/editar/duplicar/excluir/desfazer exclusão.
- Importação e exportação em JSON e CSV; prévia antes da importação com destaque de duplicatas; transação atômica, com rollback completo em caso de falha.
- Três colunas no desktop; no celular, "lista + detalhes" não aparecem mais lado a lado — tocar em um item abre diretamente a página de detalhe individual (com player).

### Duas interfaces: desktop / celular
| | Desktop (> 760 px) | Celular (≤ 760 px) |
|---|---|---|
| Navegação | Navegação horizontal no topo (inclui a visão de três colunas "Área de trabalho") | **4 abas na parte inferior**: cronômetro / conjuntos de algoritmos / biblioteca de algoritmos / configurações (alcance pelo polegar, evitando a área de gestos da tela cheia) |
| Layout | Três colunas lado a lado | Coluna única, áreas grandes (player / cronômetro grande) com altura fixa, lista com rolagem dentro do contêiner, **a página inteira não rola verticalmente** |
| Entrada | Área de trabalho `#/` | Redireciona automaticamente para `#/sets` (a área de trabalho é uma visão combinada de três colunas exclusiva do desktop) |
| Densidade de informações | Todos os campos | Remove títulos repetidos, contagens duplicadas e explicações longas, mantendo apenas as operações essenciais |

### Interface em seis idiomas
- A interface oferece suporte a 简体中文 / English / 日本語 / Русский / Español / Português (BR), com troca instantânea em "Configurações → Idioma" e persistência da escolha; a opção "Seguir o sistema" é resolvida a partir do idioma preferido do navegador.
- As camadas inferiores (`domain` / `application` / `infrastructure`) não contêm textos de interface; as traduções ficam concentradas na camada de apresentação, em `src/presentation/i18n/`. As chaves do dicionário são derivadas do idioma de referência: chaves ausentes ou extras geram erro de tipo, e testes unitários verificam que os conjuntos de chaves e os marcadores de interpolação são iguais nos seis idiomas.
- O próprio README também está disponível em seis idiomas, com troca em uma única linha no topo.

### Atalhos de teclado (player)
| Tecla | Ação |
|---|---|
| `Space` | Reproduzir / pausar (na página do cronômetro, inicia/para a contagem) |
| `←` / `→` | Passo anterior / próximo passo |
| `Home` / `End` | Ir para o início / fim |
| `Delete` | Exclui o último tempo na página do cronômetro |
| `Esc` | Fecha a caixa de diálogo / cancela a contagem |

---

## Início rápido

```bash
npm install
npm run dev          # http://localhost:5173
```

### Todos os comandos

```bash
npm run dev            # servidor de desenvolvimento
npm run build          # verificação de tipos + build de produção (vue-tsc --noEmit && vite build)
npm run preview        # prévia do build de produção
npm run check          # typecheck + verificação de arquitetura + 115 testes unitários
npm run test           # executa apenas o Vitest
npm run test:e2e       # Playwright (44 execuções: 38 no projeto desktop + 6 no projeto mobile)
npm run data:build     # regera os conjuntos de algoritmos embutidos (os resultados do scrape estão em data/raw/)
npm run desktop:build  # empacota a versão desktop → out/TwistyAtlas/TwistyAtlas.exe
npm run android:apk    # empacota o Android → out/TwistyAtlas-1.3.0-android-debug.apk
```

---

## Duas opções de empacotamento

| Alvo | Tecnologia | Produto |
|---|---|---|
| Computador (Windows x64) | Electron 45 (`contextIsolation` + `sandbox`) | `out/TwistyAtlas/TwistyAtlas.exe` (367 MB, sem instalação) |
| Celular Android | Capacitor 8 + Gradle (minSdk 24 / targetSdk 36, JDK 21) | `out/TwistyAtlas-1.3.0-android-debug.apk` (5,1 MB) |

As etapas, os requisitos de ambiente, as armadilhas encontradas e as conclusões dos testes estão em [`docs/PACKAGING.md`](docs/PACKAGING.md).

---

## Arquitetura

Em camadas (`domain / application / infrastructure / presentation / data`), com a direção das dependências protegida estaticamente por `scripts/check-arch.mjs` (67 arquivos);
`cubing/*` só pode aparecer em `infrastructure/cubing`:

```
src/
  domain/                  # lógica pura, zero dependência de framework
    model/                 #   algoritmos, cubos, tempos, configurações, orientação de demonstração (orientation)
    timer/                 #   máquina de estados do cronômetro (funções puras), estatísticas, formatação
  application/
    sets/                  #   carregamento e categorização dos conjuntos de algoritmos embutidos
    timer/                 #   exportação de tempos (CSV / JSON / texto, funções puras)
  infrastructure/
    cubing/                # único lugar que interage com o cubing.js (inclui adapters/)
    persistence/           #   Dexie: algoritmos, tempos, configurações
  presentation/            # componentes Vue / views / store Pinia / rotas / composables / i18n
  data/algsets.json        # conjuntos de algoritmos gerados em tempo de build (chunk separado, não carregado na primeira tela)
e2e/                       # Playwright (desktop + mobile)
scripts/                   # pipeline de dados, verificação de arquitetura, empacotamento, validação e capturas
docs/                      # arquitetura, dados, empacotamento, evidências de aceitação
```

Os detalhes estão em [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## Testes e evidências

```
Testes unitários   115 (Vitest)  —— limites do cronômetro / estatísticas / validação de algoritmos / importação e exportação / posicionamento na reprodução / formatação da exportação / conjugação da face inferior / dicionários dos seis idiomas
Ponta a ponta     44 execuções (Playwright) —— WebGL real, consistência de estado, persistência, sem rolagem da página inteira no mobile, abas acessíveis, troca de idioma
Verificação de arquitetura   67 arquivos, sem dependências fora dos limites
Validação de dados   2433 casos / 13667 algoritmos verificados um a um pelo motor (399 rejeitados)
```

```bash
# teste real de renderização e estado por cubo (reescreve docs/capability-raw.md e docs/screenshots/puzzle-*.png)
node scripts/verify-puzzles.mjs

# teste rápido do build de produção (execute primeiro npx vite preview --port 4173)
node scripts/verify-dist.mjs

# verificação página por página do produto desktop (inicie primeiro out/TwistyAtlas/TwistyAtlas.exe --remote-debugging-port=9222)
node scripts/verify-desktop.mjs

# arquivamento de capturas do desktop; capturas das quatro páginas do celular + inspeção quantificada de "sem rolagem da página / sem overflow horizontal / abas dentro da viewport"
node scripts/shots.mjs
node scripts/shot-mobile.mjs
```

---

## Documentação

| Arquivo | Conteúdo |
|---|---|
| `docs/ARCHITECTURE.md` | camadas, regras de dependência, módulos principais, fluxo de dados, pontos de extensão, estratégia de rotas no mobile |
| `docs/PACKAGING.md` | comandos, ambiente, armadilhas e conclusões dos testes das duas opções de empacotamento |
| `docs/DATA_SOURCES.md` | origem dos 37 conjuntos de algoritmos, critérios estruturais, itens rejeitados, lacunas conhecidas |
| `docs/API_VERIFICATION.md` | verificação item a item da API do cubing.js (versões, assinaturas, saída em tempo de execução, suposições refutadas) |
| `docs/CUBING_CAPABILITY_MATRIX.md` | conclusões dos testes item a item de 10 tipos de cubo (inclui por que o Square-1 só pode ser 2D) |
| `docs/TECH_DECISIONS.md` | decisões técnicas: escolhas, abordagens descartadas, motivos e custos |
| `docs/ACCEPTANCE_REPORT.md` | relatório de aceitação das fases A–H + adendos v1.2 / v1.3 |
| `docs/screenshots/` | capturas reais do desktop, do celular (390×844 / 360×800), de cada tipo de cubo, do cronômetro e dos conjuntos de algoritmos |
| `README.{en,ja,ru,es,pt-BR}.md` | READMEs em seis idiomas, com troca mútua em uma única linha no topo |

---

## Dados e privacidade

- Todos os dados ficam no IndexedDB do navegador (nome do banco `TwistyAtlasDB`), **sem envio para servidores, sem contas e sem backend**.
- Limpar os dados do site apaga algoritmos/tempos; recomenda-se fazer backups periódicos com "Exportar JSON".
- A importação aceita apenas campos da lista de permissões, e o HTML é renderizado como texto simples (há um caso de teste específico que verifica que scripts não são executados).

---

## Limitações conhecidas

1. **Square-1 tem apenas renderização 2D**: em `cubing@0.66.1`, a `visualizationStrategy` do Square-1 foi medida como `2D` na prática — não há um modelo real de deformação 3D. A área de reprodução exibe o selo "renderização 2D" e **não finge ser 3D**.
2. **Cubos reproduzíveis limitados a 10 tipos**: o motor inclui 21, mas os que não passaram pela validação estado a estado não aparecem no seletor.
3. **Pacote Android não testado em dispositivo real**: a compilação passou e a estrutura do pacote foi validada, mas não havia AVD/dispositivo nesta máquina, então não foi feita a verificação de instalação e execução.
4. **Versão desktop sem assinatura e com ícone padrão**: na primeira execução, pode aparecer o aviso de "publicante desconhecido".
5. **A atualização automática do PWA pode interromper a edição**: `registerType: 'autoUpdate'`, sem implementação de "adiar a atualização quando houver alterações não salvas".
6. **Sem sincronização em nuvem**: para transferir entre dispositivos, use exportação / importação.
7. **Sem layout de nível de performance em modo paisagem no celular**: o modo paisagem ainda funciona, mas a altura do player é calculada por `vh`, deixando a área visível menor nesse modo.

---

## Requisitos de navegador

WebGL2 + IndexedDB + ES2022. Validado no Chromium (canal `chromium` incluído no Playwright, com renderização por software SwiftShader) e no Electron 45.

---

## Licença

[MIT](LICENSE) © 2026 yiqing1218

As bibliotecas de terceiros utilizadas (Vue, Vite, cubing.js, Dexie, Electron, Capacitor etc.) mantêm suas respectivas licenças originais; a lista completa está nos repositórios de cada dependência. Os dados dos algoritmos embutidos vêm de sites públicos de cubing; as fontes e os créditos por conjunto estão em [`docs/DATA_SOURCES.md`](docs/DATA_SOURCES.md).
