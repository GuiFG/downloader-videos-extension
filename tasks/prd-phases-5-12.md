# PRD: Implementação das Fases 5-12 - Video Downloader Extension (TDD)

## Introduction

Este PRD documenta a implementação das **Fases 5 a 12** da extensão Chrome de download de vídeos HLS/DASH. As Fases 5-7 constituem o **core functionality** (FFmpeg Concatenator, Download Manager, Service Worker), enquanto as Fases 8-12 completam a integração (Content Script, Popup UI, E2E, suporte a vídeos simples, e cobertura de testes).

Todas as implementações seguem rigorosamente a metodologia **TDD (Test-Driven Development)**: Red → Green → Refactor, com cobertura mínima de 80% em cada fase.

---

## Goals

### Goals Gerais
- ✅ Implementar 100% das Fases 5-12 com cobertura >80% em testes
- ✅ Manter ciclo TDD rigoroso (RED falha → GREEN passa → REFACTOR limpa)
- ✅ Integração completa: Network → Storage → FFmpeg → Download
- ✅ Suporte para HLS, DASH, e vídeos simples (MP4/WebM)
- ✅ UI funcional e testável em popup
- ✅ Testes E2E validando fluxo completo

### Goals por Fase
- **Fase 5**: Concatenar fragmentos com FFmpeg.wasm
- **Fase 6**: Gerenciar downloads para Chrome storage
- **Fase 7**: Interceptar requests globais e armazenar URLs detectadas
- **Fase 8**: Scanear DOM e enviar vídeos ao Service Worker
- **Fase 9**: UI pop-up listando vídeos e permitindo downloads
- **Fase 10**: Testes E2E validando fluxo completo
- **Fase 11**: Suporte a vídeos simples (fallback direto)
- **Fase 12**: Auditoria de cobertura e polimento final

---

## User Stories

### FASE 5: FFmpeg Concatenator

#### US-5.1: [RED] Escrever testes para FFmpeg Concatenator
**Description:** Como dev, preciso de testes que validem concatenação de fragmentos de vídeo, para garantir que o FFmpeg.wasm funciona corretamente.

**Acceptance Criteria:**
- [ ] Arquivo `__tests__/ffmpeg-concatenator.test.js` criado com 6+ testes
  - [ ] Teste: `concatenateFragments(blobArray)` retorna Blob (arquivo MP4)
  - [ ] Teste: suporta tipos `.ts`, `.m4s` (segmentos HLS/DASH)
  - [ ] Teste: arquivo gerado tem metadados válidos (duration, codec)
  - [ ] Teste: arquivo é playable (headers válidos de vídeo)
  - [ ] Teste: lidar com arquivo grande (100MB+ simulado)
  - [ ] Teste: erro FFmpeg capturado com try/catch
- [ ] Mock FFmpeg.wasm criado: `__tests__/mocks/ffmpeg.mock.js`
- [ ] Todos os testes FALHAM (código não existe)
- [ ] Commit: `test(ffmpeg-concatenator): [RED] write tests for blob concatenation`

**Estimativa:** 2h

---

#### US-5.2: [GREEN] Implementar FFmpeg Concatenator
**Description:** Como dev, preciso implementar a concatenação de fragmentos usando FFmpeg.wasm, para que os segmentos baixados formem um arquivo MP4 válido.

**Acceptance Criteria:**
- [ ] Arquivo `src/utils/ffmpeg-concatenator.js` criado com função principal:
  - [ ] `concatenateFragments(blobs, outputFormat="mp4")` exportada
  - [ ] Lazy-load FFmpeg.wasm (apenas quando necessário)
  - [ ] Escrever blobs no filesystem virtual do FFmpeg
  - [ ] Executar: `ffmpeg -i concat:segment1.ts|segment2.ts -c copy output.mp4`
  - [ ] Ler arquivo de saída como Blob
  - [ ] Retornar: `Blob` do arquivo MP4 final
- [ ] Todos os testes PASSAM (`npm test -- __tests__/ffmpeg-concatenator.test.js`)
- [ ] ESLint limpo (`npm run lint`)
- [ ] Commit: `feat(ffmpeg-concatenator): [GREEN] implement blob concatenation with FFmpeg`

**Estimativa:** 4h

---

#### US-5.3: [REFACTOR] Otimizar FFmpeg Concatenator
**Description:** Como dev, preciso otimizar o concatenador para não bloquear a main thread e suportar cancelamento, para melhor UX durante concatenação.

**Acceptance Criteria:**
- [ ] Usar Web Worker para não bloquear main thread
  - [ ] Criar `src/utils/ffmpeg-worker.js`
  - [ ] Message-based communication: `{type: "concatenate", blobs, format}`
  - [ ] Suportar `AbortSignal` para cancelamento
- [ ] Adicionar suporte a resumption e progresso
  - [ ] Callback `onProgress(percent)` chamado durante concatenação
  - [ ] Exemplo: `{type: "progress", percent: 45}`
- [ ] Cache do FFmpeg.wasm carregado (reusar entre chamadas)
  - [ ] Variável module-scope: `let ffmpegInstance = null`
- [ ] Testes ainda PASSAM (`npm test`)
- [ ] Coverage mantém >80%
- [ ] Commit: `refactor(ffmpeg-concatenator): [REFACTOR] add Web Worker + progress callback`

**Estimativa:** 3h

---

### FASE 6: Download Manager

#### US-6.1: [RED] Escrever testes para Download Manager
**Description:** Como dev, preciso testar a integração com `chrome.downloads.download()` e geração de nomes únicos, para garantir que blobs são salvos corretamente.

**Acceptance Criteria:**
- [ ] Arquivo `__tests__/download-manager.test.js` criado com 7+ testes:
  - [ ] Teste: `downloadBlob(blob, filename)` invoca `chrome.downloads.download()`
  - [ ] Teste: `generateFilename(videoUrl, type)` retorna `video_20260316_1080p.mp4`
  - [ ] Teste: detecta conflito de nome e adiciona sufixo: `video_20260316_1080p (1).mp4`
  - [ ] Teste: sanitiza nome (remove caracteres inválidos)
  - [ ] Teste: suporta tipos: "hls", "dash", "simple"
  - [ ] Teste: gera metadados: timestamp, qualidade, tipo
  - [ ] Teste: `chrome.downloads` retorna ID do download
- [ ] Mock `chrome.downloads` API
- [ ] Todos os testes FALHAM
- [ ] Commit: `test(download-manager): [RED] write tests for blob download`

**Estimativa:** 1.5h

---

#### US-6.2: [GREEN] Implementar Download Manager
**Description:** Como dev, preciso implementar download de blobs para o disco usando `chrome.downloads` API, para que o arquivo final seja salvo.

**Acceptance Criteria:**
- [ ] Arquivo `src/utils/download-manager.js` criado:
  - [ ] `downloadBlob(blob, filename, options={})` exportada
    - [ ] Criar blob URL: `URL.createObjectURL(blob)`
    - [ ] Invocar: `chrome.downloads.download({url: blobUrl, filename, saveAs: false})`
    - [ ] Retornar: `downloadId` (inteiro)
    - [ ] Limpar blob URL após envio: `URL.revokeObjectURL(url)`
  - [ ] `generateFilename(baseUrl, type, quality="unknown")` exportada
    - [ ] Formato: `video_${date}_${quality}.${ext}`
    - [ ] Exemplo: `video_20260316_1080p.mp4`
    - [ ] Sanitizar: remover `/ \ : * ? " < > |` etc
  - [ ] `sanitizeFilename(name)` helper (regex)
- [ ] Todos os testes PASSAM
- [ ] Commit: `feat(download-manager): [GREEN] implement blob download with chrome.downloads`

**Estimativa:** 2h

---

#### US-6.3: [REFACTOR] Otimizar Download Manager
**Description:** Como dev, preciso adicionar customização de diretório e melhor tratamento de conflitos, para dar mais controle ao usuário.

**Acceptance Criteria:**
- [ ] Adicionar customização de diretório via storage
  - [ ] Função: `setDownloadDirectory(dirPath)` → armazena em `chrome.storage.local`
  - [ ] Função: `getDownloadDirectory()` → busca ou retorna default
- [ ] Melhorar sanitização (Unicode, emojis, caracteres especiais)
  - [ ] Testar com nomes: `"café_naïve_🎬.mp4"` → `"cafe_naive_.mp4"`
- [ ] Tracking de status em storage
  - [ ] Estrutura: `{downloadId, filename, status, progress, timestamp}`
  - [ ] Status: "pending" | "in-progress" | "completed" | "failed"
- [ ] Suporte a resumption (Range headers) se servidor permite
  - [ ] Adicionar opção: `{resumable: true}`
- [ ] Testes ainda PASSAM
- [ ] Coverage >80%
- [ ] Commit: `refactor(download-manager): [REFACTOR] add directory customization + status tracking`

**Estimativa:** 2h

---

### FASE 7: Service Worker

#### US-7.1: [RED] Escrever testes para Service Worker
**Description:** Como dev, preciso testar que o Service Worker intercepta requests e armazena URLs, para validar captura de vídeos pela rede.

**Acceptance Criteria:**
- [ ] Arquivo `__tests__/service-worker.test.js` criado com 7+ testes:
  - [ ] Teste: listener `chrome.webRequest.onBeforeRequest` captura `.m3u8`, `.mpd`
  - [ ] Teste: armazena URL em `chrome.storage.local`
  - [ ] Teste: message handler `"GET_VIDEOS"` retorna lista do storage
  - [ ] Teste: message handler `"ADD_VIDEO"` adiciona com deduplicação
  - [ ] Teste: deduplicação (mesma URL não é adicionada 2x)
  - [ ] Teste: message handler `"CLEAR_VIDEOS"` limpa storage
  - [ ] Teste: listener de storage mantém Popup sincronizado
- [ ] Mock: `chrome.webRequest`, `chrome.storage.local`, `chrome.runtime.onMessage`
- [ ] Todos os testes FALHAM
- [ ] Commit: `test(service-worker): [RED] write tests for request interception`

**Estimativa:** 2h

---

#### US-7.2: [GREEN] Implementar Service Worker
**Description:** Como dev, preciso implementar o Service Worker para interceptar e armazenar URLs de vídeo detectadas, para que o Popup tenha acesso a elas.

**Acceptance Criteria:**
- [ ] Arquivo `src/background/service-worker.js` criado:
  - [ ] `chrome.webRequest.onBeforeRequest.addListener()` implementado
    - [ ] Filtrar por extensão usando `isMediaURL()` de `media-extensions.js`
    - [ ] Armazenar em `chrome.storage.local` com deduplicação (Set)
    - [ ] Estrutura: `{url, type, timestamp, tabId}`
  - [ ] Message handlers implementados:
    - [ ] `"GET_VIDEOS"` → retorna array de URLs
    - [ ] `"ADD_VIDEO"` → adiciona manual (para Content Script)
    - [ ] `"CLEAR_VIDEOS"` → limpa armazenamento
    - [ ] `"DOWNLOAD_VIDEO"` → inicia pipeline de download
  - [ ] Broadcast atualizações para Popup via `chrome.runtime.sendMessage()`
- [ ] Importar e usar módulos já implementados:
  - [ ] `media-extensions.js` para `isMediaURL()`
  - [ ] `hls-parser.js`, `dash-parser.js`
  - [ ] `fragment-downloader.js`
  - [ ] `ffmpeg-concatenator.js`
  - [ ] `download-manager.js`
- [ ] Todos os testes PASSAM
- [ ] Commit: `feat(service-worker): [GREEN] implement request interception and storage`

**Estimativa:** 3h

---

#### US-7.3: [REFACTOR] Otimizar Service Worker
**Description:** Como dev, preciso adicionar logging, timestamps, e persistência melhorada, para melhor debug e UX.

**Acceptance Criteria:**
- [ ] Adicionar persistência entre sessões
  - [ ] Usar `chrome.storage.local` como source of truth
  - [ ] Carregar ao inicializar: `loadVideosFromStorage()`
- [ ] Melhorar logging para debug (flag `DEBUG_SERVICE_WORKER`)
  - [ ] Log quando URL é capturada
  - [ ] Log quando handler é chamado
  - [ ] Log erros de parsing/download
- [ ] Adicionar timestamp de detecção em cada vídeo
  - [ ] Campo: `detectedAt: Date.now()`
  - [ ] Útil para sorting no Popup
- [ ] Melhorar deduplicação (comparar URL normalizada)
  - [ ] `https://example.com/video.m3u8` === `https://example.com/video.m3u8?cache=123`
  - [ ] Usar `URL()` + pathname para normalizar
- [ ] Testes ainda PASSAM
- [ ] Coverage >80%
- [ ] Commit: `refactor(service-worker): [REFACTOR] add logging and deduplication`

**Estimativa:** 2h

---

### FASE 8: Content Script

#### US-8.1: [RED] Escrever testes para Content Script
**Description:** Como dev, preciso testar scanning do DOM e envio de URLs ao Service Worker, para ter fallback caso network interception falhe.

**Acceptance Criteria:**
- [ ] Arquivo `__tests__/content-script.test.js` criado com 7+ testes:
  - [ ] Teste: `findVideoElements(doc)` encontra `<video src="">`
  - [ ] Teste: `findVideoElements(doc)` encontra `<video><source src="">`
  - [ ] Teste: extrai atributos: `src`, `type`
  - [ ] Teste: ignora vídeos sem src
  - [ ] Teste: deduplicação de URLs
  - [ ] Teste: `MutationObserver` detecta novos vídeos adicionados dinamicamente
  - [ ] Teste: envia mensagem ao Service Worker via `chrome.runtime.sendMessage()`
- [ ] Mock: `document`, `chrome.runtime`, `MutationObserver`
- [ ] Todos os testes FALHAM
- [ ] Commit: `test(content-script): [RED] write tests for DOM scanning`

**Estimativa:** 1.5h

---

#### US-8.2: [GREEN] Implementar Content Script
**Description:** Como dev, preciso implementar scanning do DOM e envio de URLs ao Service Worker, para capturar vídeos que o network interception perdeu.

**Acceptance Criteria:**
- [ ] Arquivo `src/content/content-script.js` criado:
  - [ ] Função `findVideoElements()` implementada
    - [ ] Query: `document.querySelectorAll('video')`
    - [ ] Extrair `src` de `<video>` direto ou `<source>` filhos
    - [ ] Deduplicate URLs
  - [ ] Enviar ao Service Worker
    - [ ] `chrome.runtime.sendMessage({type: "ADD_VIDEO", url, source: "dom"})`
  - [ ] Setup `MutationObserver` para detectar novos vídeos
    - [ ] Observar mudanças no `document.body`
    - [ ] Chamar `findVideoElements()` quando vídeos são adicionados
  - [ ] Executar ao carregar: `findVideoElements()` no `DOMContentLoaded`
- [ ] Todos os testes PASSAM
- [ ] Commit: `feat(content-script): [GREEN] implement DOM scanning with MutationObserver`

**Estimativa:** 2h

---

#### US-8.3: [REFACTOR] Otimizar Content Script
**Description:** Como dev, preciso melhorar seletores para iframes/shadow DOM e otimizar MutationObserver, para capturar mais vídeos.

**Acceptance Criteria:**
- [ ] Melhorar seletor de vídeos
  - [ ] Considerar `<iframe>` (tentar acessar conteúdo se same-origin)
  - [ ] Considerar shadow DOM: `Element.prototype.attachShadow`
  - [ ] Suportar data attributes: `data-video-url`, `data-stream-url`
- [ ] Otimizar MutationObserver
  - [ ] Usar `subtree: true, childList: true` (não observar atributos desnecessários)
  - [ ] Debounce: não scanear em cada mudança, agregar múltiplas
  - [ ] Threshold: não reportar se URL já conhecida
- [ ] Adicionar suporte a custom atributos
  - [ ] Exemplo: `<video data-download-url="...">`
- [ ] Testes ainda PASSAM
- [ ] Coverage >80%
- [ ] Commit: `refactor(content-script): [REFACTOR] add iframe + shadow DOM support`

**Estimativa:** 2h

---

### FASE 9: Popup UI

#### US-9.1: [RED] Escrever testes para Popup Logic
**Description:** Como dev, preciso testar lógica do Popup (listar vídeos, download, progresso), para validar que UI funciona corretamente.

**Acceptance Criteria:**
- [ ] Arquivo `__tests__/popup.test.js` criado com 8+ testes:
  - [ ] Teste: `getVideoList()` busca do storage e retorna array
  - [ ] Teste: `renderVideoList(videos)` gera HTML com lista
  - [ ] Teste: clique em "Baixar" invoca `downloadVideo(url)`
  - [ ] Teste: `downloadVideo(url)` com HLS detecta tipo e chama parser
  - [ ] Teste: `downloadVideo(url)` com MP4 simples faz download direto
  - [ ] Teste: barra de progresso atualiza durante download
  - [ ] Teste: mensagem de sucesso/erro é exibida
  - [ ] Teste: botão "Limpar" invoca `clearVideos()`
- [ ] Mock: `chrome.storage`, `chrome.runtime.sendMessage`, DOM
- [ ] Todos os testes FALHAM
- [ ] Commit: `test(popup): [RED] write tests for popup logic`

**Estimativa:** 2h

---

#### US-9.2: [GREEN] Implementar Popup UI
**Description:** Como dev, preciso implementar a UI do Popup com HTML, CSS e JavaScript, para que usuário veja e baixe vídeos detectados.

**Acceptance Criteria:**
- [ ] Arquivo `src/popup/popup.html` criado:
  - [ ] Lista `<ul id="video-list">` (preenchida pela JS)
  - [ ] Botão "Baixar" para cada vídeo
  - [ ] Botão "Limpar tudo"
  - [ ] Barra de progresso `<progress id="download-progress">`
  - [ ] Área de status `<div id="status-message">`
- [ ] Arquivo `src/popup/popup.css` criado:
  - [ ] Estilos básicos: list, buttons, progress bar
  - [ ] Responsive design (extensão é pequena)
  - [ ] Cores: green sucesso, red erro, gray padrão
- [ ] Arquivo `src/popup/popup.js` criado:
  - [ ] `getVideoList()` → buscar do storage via `chrome.storage.local.get()`
  - [ ] `renderVideoList(videos)` → preencher lista com HTML
  - [ ] Event listeners: clique em "Baixar", clique em "Limpar"
  - [ ] `downloadVideo(url)` → detectar tipo → chamar Service Worker
  - [ ] Listeners de resposta do Service Worker para progresso e status
  - [ ] UI atualiza em tempo real durante download
- [ ] Todos os testes PASSAM
- [ ] Verify in browser using dev-browser skill (validar visuais)
- [ ] Commit: `feat(popup): [GREEN] implement popup UI with HTML/CSS/JS`

**Estimativa:** 3h

---

#### US-9.3: [REFACTOR] Otimizar Popup UI
**Description:** Como dev, preciso melhorar UX (ícones, filtros, sorting), para que Popup seja mais usável.

**Acceptance Criteria:**
- [ ] Melhorar UX visual
  - [ ] Adicionar ícones por tipo de vídeo (HLS 📺, DASH 🎬, MP4 🎞️)
  - [ ] Indicador visual de qualidade (1080p, 720p, etc)
  - [ ] Melhor feedback durante download (animação, porcentagem)
- [ ] Adicionar filtros
  - [ ] Dropdown: "Todos | HLS | DASH | MP4"
  - [ ] Filter persiste em extensão storage
- [ ] Melhorar sorting
  - [ ] Mais recente primeiro (por `detectedAt`)
  - [ ] Opção de sorting por qualidade
- [ ] Melhorar responsiveness
  - [ ] Popup redimensionável
  - [ ] Scroll em lista longa
- [ ] Testes ainda PASSAM
- [ ] Coverage >80%
- [ ] Verify in browser using dev-browser skill
- [ ] Commit: `refactor(popup): [REFACTOR] improve UX with filters and icons`

**Estimativa:** 2.5h

---

### FASE 10: Testes de Integração (E2E)

#### US-10.1: [RED] Escrever testes E2E
**Description:** Como dev, preciso de testes E2E que validem fluxo completo (rede → storage → download → arquivo), para garantir integração entre todos os componentes.

**Acceptance Criteria:**
- [ ] Arquivo `__tests__/e2e.test.js` criado com 6+ testes:
  - [ ] Setup: Puppeteer para abrir Chrome com extensão carregada
  - [ ] Teste: navegar para site com HLS → capturar → listar no Popup → baixar
  - [ ] Teste: navegar para site com DASH → idem
  - [ ] Teste: navegar para site com MP4 simples → idem
  - [ ] Teste: arquivo final é válido (headers de vídeo OK, size razoável)
  - [ ] Teste: múltiplos vídeos na mesma página
- [ ] Setup: mock server Node.js com vídeos reais ou fixtures
  - [ ] Servidor em `http://localhost:8888` durante testes
  - [ ] Rotas: `/hls/sample.m3u8`, `/dash/sample.mpd`, `/video.mp4`
- [ ] Todos os testes FALHAM (integração incompleta)
- [ ] Commit: `test(e2e): [RED] write end-to-end integration tests`

**Estimativa:** 3h

---

#### US-10.2: [GREEN] Integração End-to-End
**Description:** Como dev, preciso validar que todos os componentes trabalham juntos (Service Worker, Content Script, Popup, download), para garantir funcionalidade completa.

**Acceptance Criteria:**
- [ ] Todos os componentes integrados e funcionando:
  - [ ] Service Worker interceptando requests
  - [ ] Content Script scanning DOM
  - [ ] Popup listando vídeos detectados
  - [ ] Download pipeline (parser → fragmentos → FFmpeg → download)
- [ ] Rodar testes E2E
  - [ ] Navegar em site, detectar vídeos, fazer download
  - [ ] Arquivo salvo no disco com nome correto
  - [ ] Arquivo é playable (não corrompido)
- [ ] Debugar e corrigir bugs de integração
  - [ ] Testar com HLS, DASH, MP4
  - [ ] Validar deduplicação
  - [ ] Testar parallelismo de downloads
- [ ] Todos os testes E2E PASSAM
- [ ] Todos os testes anteriores (Fases 5-9) ainda PASSAM
- [ ] Commit: `feat(e2e): [GREEN] validate complete download pipeline`

**Estimativa:** 4h

---

#### US-10.3: [REFACTOR] Melhorar Testes E2E
**Description:** Como dev, preciso adicionar cenários avançados (downloads paralelos, sites reais), para cobrir edge cases.

**Acceptance Criteria:**
- [ ] Adicionar cenários com múltiplos downloads paralelos
  - [ ] Teste: baixar 5 vídeos simultaneamente
  - [ ] Validar que não há race conditions
  - [ ] Performance: tempo total < 1 minuto
- [ ] Testar com sites "reais" (sanitizados/mockados)
  - [ ] YouTube-like site (JS-heavy, dynamic video discovery)
  - [ ] Vimeo-like site (HLS protected)
- [ ] Performance testing
  - [ ] Medir tempo total: request → parser → fragmentos → FFmpeg → download
  - [ ] Memory profile: não vazar memory durante concatenação
  - [ ] Storage usage: limpeza após download
- [ ] Testes ainda PASSAM
- [ ] Coverage mantém >80%
- [ ] Commit: `refactor(e2e): [REFACTOR] add parallel downloads + performance tests`

**Estimativa:** 3h

---

### FASE 11: Vídeos Simples (MP4/WebM)

#### US-11.1: [RED] Escrever testes para Vídeos Simples
**Description:** Como dev, preciso testar download direto de vídeos simples (MP4, WebM, MOV), para suportar vídeos que não são HLS/DASH.

**Acceptance Criteria:**
- [ ] Arquivo `__tests__/simple-video-download.test.js` criado com 6+ testes:
  - [ ] Teste: `detectVideoType(".mp4")` retorna `"simple"`
  - [ ] Teste: `downloadSimpleVideo(url)` faz fetch e retorna Blob
  - [ ] Teste: suportar extensões: `.mp4`, `.webm`, `.mov`, `.flv`
  - [ ] Teste: valida MIME type da resposta (video/mp4, video/webm, etc)
  - [ ] Teste: progress callback funciona (reporta bytes baixados)
  - [ ] Teste: retry em falha com exponential backoff
- [ ] Mock: `fetch()` API
- [ ] Todos os testes FALHAM
- [ ] Commit: `test(simple-video): [RED] write tests for direct video download`

**Estimativa:** 1.5h

---

#### US-11.2: [GREEN] Implementar Vídeos Simples
**Description:** Como dev, preciso implementar download direto para vídeos simples, para que usuário possa baixar MP4 sem necessidade de FFmpeg.

**Acceptance Criteria:**
- [ ] Estender `src/utils/download-manager.js`:
  - [ ] Função `downloadSimpleVideo(url, onProgress)` exportada
  - [ ] Fetch direto: `fetch(url)`
  - [ ] Reportar progresso via `onProgress({current, total, percent})`
  - [ ] Retry automático em falha (3 tentativas)
  - [ ] Timeout: 30s por tentativa
  - [ ] Retornar: `Blob` do vídeo
- [ ] Estender `src/utils/media-extensions.js`:
  - [ ] Adicionar tipos simples: `"video-mp4"`, `"video-webm"`, etc
  - [ ] Função `isSimpleVideoURL(url)` → identifica MP4/WebM direto
- [ ] Estender `src/popup/popup.js`:
  - [ ] Detectar tipo de URL (HLS vs DASH vs simples)
  - [ ] Router: HLS/DASH → parsers → FFmpeg vs simples → fetch direto
  - [ ] Mesmo fluxo de download, mas sem concatenação
- [ ] Todos os testes PASSAM
- [ ] Commit: `feat(simple-video): [GREEN] implement direct video download`

**Estimativa:** 2h

---

#### US-11.3: [REFACTOR] Otimizar Vídeos Simples
**Description:** Como dev, preciso adicionar resumption e melhor detecção de tipo, para robustez.

**Acceptance Criteria:**
- [ ] Suporte a resumption
  - [ ] Usar `Range` headers: `Range: bytes=0-1023`
  - [ ] Detectar se servidor suporta: verificar `Accept-Ranges` response header
  - [ ] Permitir retomar downloads parciais
- [ ] Melhor detecção de tipo
  - [ ] Prioridade: MIME headers (`Content-Type`) > extensão de arquivo
  - [ ] Validar: `Content-Type` contém `video/`
  - [ ] Fallback: usar extensão se MIME não informado
- [ ] Melhorar validação
  - [ ] Validar `Content-Length` vs blob size (não truncado)
  - [ ] Alertar usuário se size mismatch
- [ ] Testes ainda PASSAM
- [ ] Coverage >80%
- [ ] Commit: `refactor(simple-video): [REFACTOR] add resumption + header-based detection`

**Estimativa:** 1.5h

---

### FASE 12: Coverage Audit & Polish

#### US-12.1: [AUDIT] Verificar Cobertura de Testes
**Description:** Como dev, preciso auditar cobertura de testes e adicionar testes faltantes, para garantir >80% cobertura.

**Acceptance Criteria:**
- [ ] Rodar: `npm test -- --coverage`
- [ ] Gerar relatório de cobertura (HTML)
- [ ] Identificar arquivos com cobertura < 80%
- [ ] Para cada arquivo abaixo do threshold:
  - [ ] Identificar linhas/branches não testadas
  - [ ] Escrever testes para cobrir gaps
  - [ ] Validar cobertura sobe para >80%
- [ ] Atualizar badge no README: `Coverage: >80%`
- [ ] Comitar com: `test(coverage): audit coverage and add missing tests`

**Estimativa:** 2h

---

#### US-12.2: Documentação de Testes
**Description:** Como dev/usuário, preciso de documentação clara sobre como rodar testes e entender estrutura, para facilitar contribuições.

**Acceptance Criteria:**
- [ ] Criar `TESTING.md` com seções:
  - [ ] Como rodar testes: `npm test`, `npm test:watch`, `npm test:coverage`
  - [ ] Explicação de cada test suite (media-extensions, hls-parser, etc)
  - [ ] Fixtures disponíveis e como usá-las (`__tests__/fixtures/`)
  - [ ] Padrão de mocks (`__tests__/mocks/chrome-api.js`)
  - [ ] Como debugar: `node --inspect-brk ./node_modules/.bin/jest`
  - [ ] Estrutura de testes (exemplo de test case)
- [ ] Atualizar README.md com link para TESTING.md
- [ ] Comitar com: `docs(testing): add comprehensive testing guide`

**Estimativa:** 1h

---

#### US-12.3: Verificação de Performance
**Description:** Como dev, preciso validar build size e performance, para garantir extensão é viável.

**Acceptance Criteria:**
- [ ] Medir build size
  - [ ] Rodar: `npm run build`
  - [ ] Medir: `dist/service-worker.js`, `dist/content-script.js`, `dist/popup.js`
  - [ ] FFmpeg.wasm size: ~30MB (lazy-loaded)
  - [ ] Total deve ser < 100MB
- [ ] Profile runtime
  - [ ] Tempo de startup (Service Worker init): < 500ms
  - [ ] Tempo de parsing M3U8 (1000 segmentos): < 100ms
  - [ ] Tempo de parsing MPD (complexo): < 200ms
  - [ ] Memory peak durante concatenação: < 500MB
- [ ] Otimizar se necessário
  - [ ] Tree-shake código não usado
  - [ ] Minify bundle (webpack já faz em production)
  - [ ] Lazy-load FFmpeg.wasm
- [ ] Documentar resultados em README (Performance section)

**Estimativa:** 1.5h

---

#### US-12.4: Polish Final
**Description:** Como dev, preciso fazer polish final (lint, nomes, comments), para código production-ready.

**Acceptance Criteria:**
- [ ] Código sem warnings
  - [ ] `npm run lint` passa sem warnings
  - [ ] ESLint: zero violations
  - [ ] Jest: zero warnings
- [ ] Nomes descritivos
  - [ ] Arquivos: `src/utils/hls-parser.js` (não `parser.js`)
  - [ ] Funções: `parseHLS()`, `parseDALE()` (não `parse()`)
  - [ ] Variáveis: `mediaUrl`, `fragmentBlobs` (não `url`, `blobs`)
- [ ] Comments úteis (não óbvios)
  - [ ] Explicar "why", não "what"
  - [ ] Exemplo: "Why: FFmpeg.wasm não suporta AAC, usar AC3" (não "Load FFmpeg")
  - [ ] Evitar comentários desnecessários (código auto-documentado é melhor)
- [ ] README final
  - [ ] Instruções de setup
  - [ ] Como rodar testes
  - [ ] Arquitetura (3 componentes)
  - [ ] Stack (Webpack, Jest, FFmpeg.wasm)
  - [ ] Performance benchmarks
  - [ ] Known limitations (se houver)
- [ ] Commit final: `docs(project): [REFACTOR] final polish and documentation`

**Estimativa:** 1h

---

## Functional Requirements

### Fase 5 (FFmpeg Concatenator)
- **FR-5.1**: Suportar concatenação de fragmentos TS e M4S usando FFmpeg.wasm
- **FR-5.2**: Lazy-load FFmpeg para reduzir memory footprint
- **FR-5.3**: Usar Web Worker para evitar blocking main thread
- **FR-5.4**: Suportar cancelamento de concatenação via AbortSignal
- **FR-5.5**: Reportar progresso de concatenação em tempo real

### Fase 6 (Download Manager)
- **FR-6.1**: Integrar com `chrome.downloads.download()` para salvar no disco
- **FR-6.2**: Gerar nomes únicos com timestamp e qualidade
- **FR-6.3**: Sanitizar nomes de arquivo (remover caracteres inválidos)
- **FR-6.4**: Detectar conflitos de nome e adicionar sufixo
- **FR-6.5**: Armazenar metadata de download (status, progresso)
- **FR-6.6**: Suportar customização de diretório via storage
- **FR-6.7**: Suportar resumption de downloads com Range headers

### Fase 7 (Service Worker)
- **FR-7.1**: Interceptar requests de midia (HLS, DASH, MP4) via `chrome.webRequest`
- **FR-7.2**: Armazenar URLs em `chrome.storage.local` com deduplicação
- **FR-7.3**: Implementar message handlers para comunicação com Popup/Content Script
- **FR-7.4**: Orquestrar pipeline completo (parse → fragmentos → FFmpeg → download)
- **FR-7.5**: Broadcast atualizações de status para Popup em tempo real
- **FR-7.6**: Normalizar URLs para evitar duplicatas (query params, fragments)

### Fase 8 (Content Script)
- **FR-8.1**: Scanear DOM para `<video>` e `<source>` elements
- **FR-8.2**: Extrair URLs de vídeos com deduplicação
- **FR-8.3**: Usar MutationObserver para detectar vídeos adicionados dinamicamente
- **FR-8.4**: Enviar descobertas ao Service Worker via `chrome.runtime.sendMessage()`
- **FR-8.5**: Suportar iframes e shadow DOM (if same-origin)
- **FR-8.6**: Suportar data attributes customizados (`data-video-url`, etc)

### Fase 9 (Popup UI)
- **FR-9.1**: Listar vídeos detectados com tipo (HLS, DASH, MP4) e qualidade
- **FR-9.2**: Permitir download individual de cada vídeo
- **FR-9.3**: Exibir progresso de download em tempo real (barra + porcentagem)
- **FR-9.4**: Mostrar mensagens de status (sucesso, erro, em progresso)
- **FR-9.5**: Permitir limpar lista de vídeos
- **FR-9.6**: Filtrar vídeos por tipo (HLS, DASH, MP4)
- **FR-9.7**: Ordenar por recência ou qualidade
- **FR-9.8**: Ícones visuais por tipo de vídeo

### Fase 10 (E2E Tests)
- **FR-10.1**: Testar fluxo completo (rede → detecção → Popup → download)
- **FR-10.2**: Validar arquivo final é válido (headers, size, playable)
- **FR-10.3**: Testar múltiplos vídeos paralelos
- **FR-10.4**: Testar com HLS, DASH, e MP4
- **FR-10.5**: Performance: download completo < 1 min para 1GB
- **FR-10.6**: Validar não há memory leaks

### Fase 11 (Vídeos Simples)
- **FR-11.1**: Detectar e baixar vídeos simples (MP4, WebM, MOV, FLV) direto
- **FR-11.2**: Validar MIME type de resposta
- **FR-11.3**: Suportar resumption com Range headers
- **FR-11.4**: Retentar em falha com exponential backoff
- **FR-11.5**: Mesmo fluxo de UI/download que HLS/DASH

### Fase 12 (Coverage & Polish)
- **FR-12.1**: Cobertura de testes > 80% (linhas, funções, statements)
- **FR-12.2**: Branches coverage > 75%
- **FR-12.3**: ESLint zero violations
- **FR-12.4**: Build size < 100MB (FFmpeg lazy-loaded)
- **FR-12.5**: Documentação completa (README, TESTING.md)
- **FR-12.6**: Performance benchmarks documentados

---

## Non-Goals

❌ **Fora de escopo:**
- Suporte para protocolos proprietários (Adobe DRM, Widevine, etc)
- Armazenamento em nuvem (Google Drive, Dropbox, etc)
- Conversão de vídeo (apenas concatenação)
- Subtítulos (apenas vídeo + áudio)
- Edição de vídeo (trim, crop, etc)
- Suporte para vídeos HLS/DASH com criptografia DRM
- Integração com player plugins (VLC, FFmpeg desktop)
- Sync entre múltiplos dispositivos
- UI em idiomas além de English (futura localização)

---

## Design Considerations

### Architecture Overview
```
┌─────────────────────────────────────────────┐
│ Página Web (site.com/video)                 │
└────────────────────┬────────────────────────┘
                     │
     ┌───────────────┼───────────────┐
     ↓               ↓               ↓
┌──────────────┐ ┌──────────────┐ ┌────────────┐
│ Service      │ │ Content      │ │ Popup      │
│ Worker       │ │ Script       │ │ UI         │
│ (intercept)  │ │ (DOM scan)   │ │ (list+DL)  │
└──────┬───────┘ └──────┬───────┘ └────┬───────┘
       │                │              │
       └────────────────┼──────────────┘
                        │
                   ┌────▼─────┐
                   │ Storage   │
                   │ (URLs)    │
                   └────┬──────┘
                        │
       ┌────────────────┼────────────────┐
       ↓                ↓                ↓
    ┌──────────┐   ┌──────────┐   ┌──────────┐
    │ HLS      │   │ DASH     │   │ Simple   │
    │ Parser   │   │ Parser   │   │ (direct) │
    └────┬─────┘   └────┬─────┘   └────┬─────┘
         │              │              │
         └──────────────┼──────────────┘
                        │
                   ┌────▼──────────┐
                   │ Fragment      │
                   │ Downloader    │
                   │ (parallel)    │
                   └────┬──────────┘
                        │
                   ┌────▼──────────┐
                   │ FFmpeg        │
                   │ Concatenator  │
                   │ (Web Worker)  │
                   └────┬──────────┘
                        │
                   ┌────▼──────────┐
                   │ Download      │
                   │ Manager       │
                   │ (chrome.dl)   │
                   └────┬──────────┘
                        │
                   ~/Downloads/
                   video_*.mp4
```

### UI Mockup (Popup)
```
┌────────────────────────────────┐
│ 📺 Video Downloader            │
├────────────────────────────────┤
│                                │
│ Filters: [All ▼]              │
│                                │
│ 📺 sample.m3u8                │
│    HLS • 1080p • 52.3MB        │
│    [Download] [↓ Downloading]  │
│                                │
│ 🎬 sample.mpd                 │
│    DASH • 720p • 18.5MB        │
│    [Download]                  │
│                                │
│ 🎞️  video.mp4                 │
│    Simple • 480p • 12.3MB      │
│    [Download]                  │
│                                │
├────────────────────────────────┤
│ Progress: ████████░░ 75%       │
│ Status: Downloading segments... │
│                                │
│ [Clear All]                    │
└────────────────────────────────┘
```

---

## Technical Considerations

### Key Dependencies
- **@ffmpeg/ffmpeg**: WASM binary (~30MB), lazy-loaded only when needed
- **Jest**: Testing framework, jsdom for DOM simulation
- **Webpack 5**: Module bundler, separate bundles for each extension component
- **Babel**: Transpile to Chrome-compatible ES5+

### Critical Path
1. **Fase 5-7**: Core download pipeline (parser → fragmentos → FFmpeg → disk)
2. **Fase 8-9**: User detection (Service Worker, Content Script, Popup)
3. **Fase 10**: Validation of integration
4. **Fase 11-12**: Edge cases and polishing

### Known Constraints
- Chrome extension restricted to Manifest V3 (no background pages, only Service Workers)
- FFmpeg.wasm has 30MB footprint (lazy-loaded to minimize impact)
- Fragment downloading limited to 6 parallel requests (respect server rate limits)
- Content Script cannot access HTTPS iframes from different origins (CORS)
- Service Worker lifetime is managed by Chrome (may be suspended after inactivity)

### Integration Points
- **Chrome APIs**: `chrome.webRequest`, `chrome.downloads`, `chrome.storage`, `chrome.runtime`
- **Web APIs**: `fetch()`, `Blob`, `URL`, `DOMParser`, `MutationObserver`, `Web Worker`
- **Media**: M3U8 (HLS), MPD (DASH), MP4/WebM containers

### Testing Strategy
- **Unit tests**: Individual modules (parsers, downloader, etc) with 100% isolated mocks
- **Integration tests**: Service Worker + Content Script + Popup communication
- **E2E tests**: Full pipeline with mock server and real Chrome extension
- **Performance tests**: Memory, CPU, and time profiling during large downloads

---

## Success Metrics

| Métrica | Alvo | Validação |
|---------|------|-----------|
| **Cobertura de testes** | >80% linhas, >75% branches | `npm test -- --coverage` |
| **Build size** | <100MB total (FFmpeg 30MB) | `du -sh dist/` |
| **Startup latency** | Service Worker init <500ms | Chrome DevTools Profiler |
| **Parser performance** | M3U8 <100ms, MPD <200ms | `npm test -- --testNamePattern="performance"` |
| **Fragment parallelism** | 6 simultâneos sem rate limiting | Network tab Chrome DevTools |
| **Download speed** | Full 1GB em <1 min (simulated) | E2E test timing |
| **Memory peak** | <500MB durante concatenação | Chrome DevTools Memory |
| **ESLint score** | Zero violations | `npm run lint` |
| **E2E success rate** | 100% (HLS, DASH, MP4) | CI/CD pipeline |
| **UI responsiveness** | Popup responde em <100ms | Chrome Devtools Performance |

---

## Timeline & Estimativas

| Fase | Sprint | User Stories | Complexidade | Estimativa | Cumulativo |
|------|--------|-------------|---|---|---|
| **5** | 3 | 3 (RED, GREEN, REFACTOR) | Alta | 9h | 9h |
| **6** | 3 | 3 | Média | 6h | 15h |
| **7** | 3-4 | 3 | Média | 7h | 22h |
| **CORE (5-7)** | **3-4** | **9** | **Média-Alta** | **22h** | **22h** |
| **8** | 4 | 3 | Média | 5.5h | 27.5h |
| **9** | 4 | 3 | Média | 7.5h | 35h |
| **10** | 4-5 | 3 | Alta | 10h | 45h |
| **11** | 5 | 3 | Baixa | 5h | 50h |
| **12** | 5 | 4 | Baixa | 4.5h | 54.5h |
| **TOTAL** | **3-5** | **28 user stories** | **Média-Alta** | **54.5h** | **54.5h** |

**Estimativa real**: ~1 semana full-time (5 dias × 8h = 40h ideal + overhead de context-switching = ~60h prática)

---

## Open Questions

1. **FFmpeg performance**: Será que concatenar 1000+ segmentos (5GB+) mantém <500MB memory?
   - Estratégia: Testar com mock data, considerar stream-based processing se overflow

2. **Chrome API rate limits**: `chrome.downloads.download()` tem limite de requisições simultâneas?
   - Estratégia: Max 6 downloads paralelos, fila para excedentes

3. **DRM/Criptografia**: Suportar vídeos com Widevine/PlayReady?
   - Decisão: **Fora de escopo** (Fase 12 — não adicionado)

4. **Resumption de downloads**: Servidor web sempre suporta `Range` headers?
   - Estratégia: Detectar `Accept-Ranges` response header, fallback para re-download

5. **Shadow DOM em vídeos**: Muitos sites usam shadow DOM para `<video>`?
   - Estratégia: Tentar acessar se same-origin, fallback para network interception

6. **FFmpeg.wasm versioning**: Qual versão stable usar?
   - Decisão: Latest stable (0.12.10+), test com 2-3 versões

---

## Fase de Execução

Após aprovação deste PRD, as implementações devem seguir este padrão **para cada user story**:

```bash
# 1. RED: Escrever teste que FALHA
npm test -- __tests__/[module].test.js
# Esperado: ✗ FAIL (arquivo/função não existe)

# 2. GREEN: Implementar código mínimo para PASSAR
# (editar src/[module].js)
npm test -- __tests__/[module].test.js
# Esperado: ✓ PASS

# 3. REFACTOR: Limpar sem quebrar testes
# (melhorias de código)
npm test -- __tests__/[module].test.js
# Esperado: ✓ PASS

# 4. Commit
git add .
git commit -m "feat/test/refactor([module]): [PHASE] description"

# 5. Próxima user story...
```

---

## Approval & Next Steps

✅ **Este PRD define requisitos completos para Fases 5-12**

Próximos passos após aprovação:
1. Usuário aprova PRD
2. Claude Code inicia **Fase 5 (FFmpeg Concatenator)** com US-5.1 [RED]
3. Segue metodologia TDD para cada user story
4. Commit ao final de cada US (RED/GREEN/REFACTOR)
5. Próxima fase começada após anterior estar ✅

**Estimativa total**: 54.5h de implementação (1 semana full-time)
