# Tasks: Extensão de Download de Vídeo (TDD-Driven)

## 🎯 Princípio TDD: Red → Green → Refactor

Para **cada** feature/módulo:
1. **[RED]**: Escrever teste que FALHA (especifica comportamento esperado)
2. **[GREEN]**: Escrever código MÍNIMO para passar no teste
3. **[REFACTOR]**: Limpar, otimizar, seguir padrões (mantendo testes passando)

---

## Fase 0: Setup & Test Infrastructure (Sprint 0) 

### 0.1 Inicializar Projeto
- [x] Criar estrutura: `src/`, `src/background/`, `src/content/`, `src/popup/`, `src/utils/`, `public/icons/`, `__tests__/`
- [x] Criar `package.json` com scripts: `test`, `test:watch`, `build`, `dev`
- [x] Criar `.gitignore` (node_modules, dist, build)

### 0.2 Configurar Jest
- [x] Instalar: `jest`, `@testing-library/dom`, `jest-environment-jsdom`
- [x] Criar `jest.config.js`: configurar coverage >80%, jsdom environment
- [x] Criar arquivo de help para testes: `__tests__/jest.setup.js` (mocks globais de chrome API)
- [x] Adicionar script npm: `test` e `test:watch`

### 0.3 Configurar Build & Lint
- [x] Instalar: `webpack`, `webpack-cli`, `babel-loader`, `eslint`
- [x] Criar `webpack.config.js` para bundle de Service Worker, Content Script, Popup
- [x] Criar `.eslintrc.json`
- [x] Adicionar npm scripts: `build`, `dev`

### 0.4 Configurar Manifest.json (Base)
- [x] Criar `manifest.json` com Manifest V3:
  - Metadados (name, version, description)
  - permissions: `webRequest`, `downloads`, `activeTab`, `tabs`, `storage`
  - `host_permissions: ["<all_urls>"]`
  - Action (popup icon)
  - Scripts: background (Service Worker), content scripts
  - Ícones (placeholder pelos agora)

### 0.5 Setup CI/Testing Mocks
- [x] Criar `__tests__/mocks/chrome-api.js` - mock global de `chrome.*` APIs
- [x] Criar `__tests__/fixtures/` diretório para test data (HLS, DASH, JSON samples)
- [x] Documentar: como rodar os testes, padrão de fixtures

### 0.6 Verificação
- [x] `npm test` funciona (mesmo que sem testes ainda)
- [x] ESLint está configurado
- [x] Webpack build não tem erros
- [x] ✅ Fase 0 concluída: ambiente preparado para TDD

---

## Instruções Passo a Passo - Phase 0

### 1️⃣ Criar Estrutura de Diretórios

```bash
cd c:\Users\Gui27\Documents\Projetos\downloader

# Criar diretórios
mkdir src src\background src\content src\popup src\utils
mkdir __tests__ __tests__\fixtures __tests__\mocks
mkdir public public\icons
```

### 2️⃣ Inicializar `package.json`

```bash
npm init -y
```

Depois edite o `package.json` gerado para conter:

```json
{
  "name": "video-downloader-extension",
  "version": "0.1.0",
  "description": "Chrome extension to download HLS/DASH streaming videos",
  "main": "index.js",
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "build": "webpack --mode production",
    "dev": "webpack --mode development --watch",
    "lint": "eslint src/ __tests__/"
  },
  "keywords": ["extension", "video", "download", "hls", "dash"],
  "author": "Your Name",
  "license": "MIT",
  "devDependencies": {
    "@babel/core": "^7.23.5",
    "@babel/preset-env": "^7.23.5",
    "@testing-library/dom": "^9.3.4",
    "babel-loader": "^9.1.3",
    "eslint": "^8.56.0",
    "jest": "^29.7.0",
    "jest-environment-jsdom": "^29.7.0",
    "webpack": "^5.90.3",
    "webpack-cli": "^5.1.4"
  },
  "dependencies": {
    "@ffmpeg/ffmpeg": "^0.12.10"
  }
}
```

Instale as dependências:
```bash
npm install
```

### 3️⃣ Criar `.gitignore`

Arquivo: `.gitignore`

```gitignore
node_modules/
dist/
build/
*.log
.DS_Store
.env
coverage/
__tests__/fixtures/*.mp4
__tests__/fixtures/*.ts
```

### 4️⃣ Criar `jest.config.js`

Arquivo: `jest.config.js`

```javascript
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/__tests__/jest.setup.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/**/index.js',
  ],
  coverageThreshold: {
    global: {
      lines: 80,
      functions: 80,
      branches: 75,
      statements: 80,
    },
  },
  testMatch: ['**/__tests__/**/*.test.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
```

### 5️⃣ Criar `webpack.config.js`

Arquivo: `webpack.config.js`

```javascript
const path = require('path');

module.exports = [
  {
    name: 'service-worker',
    mode: 'development',
    entry: './src/background/service-worker.js',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'service-worker.js',
    },
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: 'babel-loader',
        },
      ],
    },
  },
  {
    name: 'content-script',
    mode: 'development',
    entry: './src/content/content-script.js',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'content-script.js',
    },
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: 'babel-loader',
        },
      ],
    },
  },
  {
    name: 'popup',
    mode: 'development',
    entry: './src/popup/popup.js',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'popup.js',
    },
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: 'babel-loader',
        },
      ],
    },
  },
];
```

### 6️⃣ Criar `.eslintrc.json`

Arquivo: `.eslintrc.json`

```json
{
  "env": {
    "browser": true,
    "es2021": true,
    "jest": true,
    "node": true
  },
  "extends": "eslint:recommended",
  "parserOptions": {
    "ecmaVersion": "latest",
    "sourceType": "module"
  },
  "rules": {
    "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
    "no-console": "off"
  }
}
```

### 7️⃣ Criar `.babelrc`

Arquivo: `.babelrc`

```json
{
  "presets": [
    ["@babel/preset-env", { "targets": { "browsers": ["last 2 Chrome versions"] } }]
  ]
}
```

### 8️⃣ Criar `manifest.json`

Arquivo: `manifest.json`

```json
{
  "manifest_version": 3,
  "name": "Video Downloader",
  "version": "0.1.0",
  "description": "Download HLS and DASH streaming videos",
  "icons": {
    "16": "public/icons/icon-16.png",
    "48": "public/icons/icon-48.png",
    "128": "public/icons/icon-128.png"
  },
  "permissions": [
    "webRequest",
    "downloads",
    "activeTab",
    "tabs",
    "storage"
  ],
  "host_permissions": [
    "<all_urls>"
  ],
  "action": {
    "default_title": "Video Downloader",
    "default_popup": "src/popup/popup.html"
  },
  "background": {
    "service_worker": "dist/service-worker.js"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["dist/content-script.js"],
      "run_at": "document_start"
    }
  ]
}
```

### 9️⃣ Criar `__tests__/jest.setup.js` (Mocks de Chrome API)

Arquivo: `__tests__/jest.setup.js`

```javascript
// Mock global de chrome API
global.chrome = {
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn(),
    },
  },
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn(),
      clear: jest.fn(),
    },
  },
  downloads: {
    download: jest.fn(),
    onChanged: {
      addListener: jest.fn(),
    },
  },
  webRequest: {
    onBeforeRequest: {
      addListener: jest.fn(),
    },
    onResponseStarted: {
      addListener: jest.fn(),
    },
  },
  tabs: {
    query: jest.fn(),
    sendMessage: jest.fn(),
  },
};

// Mock fetch (se necessário)
global.fetch = jest.fn();

// Mock de indexedDB (básico)
Object.defineProperty(window, 'indexedDB', {
  value: {
    open: jest.fn(),
  },
});
```

### 🔟 Criar `__tests__/mocks/chrome-api.js`

Arquivo: `__tests__/mocks/chrome-api.js`

```javascript
/**
 * Chrome API Mock para testes
 * Fornece implementação mock de todas as APIs de Chrome usadas pela extensão
 */

export const createChromeMock = () => {
  return {
    runtime: {
      sendMessage: jest.fn(),
      onMessage: {
        addListener: jest.fn(),
      },
    },
    storage: {
      local: {
        get: jest.fn((keys, callback) => {
          callback({});
        }),
        set: jest.fn((items, callback) => {
          if (callback) callback();
        }),
        remove: jest.fn((keys, callback) => {
          if (callback) callback();
        }),
        clear: jest.fn((callback) => {
          if (callback) callback();
        }),
      },
    },
    downloads: {
      download: jest.fn((options, callback) => {
        if (callback) callback(1);
        return 1;
      }),
      onChanged: {
        addListener: jest.fn(),
      },
    },
    webRequest: {
      onBeforeRequest: {
        addListener: jest.fn(),
      },
      onResponseStarted: {
        addListener: jest.fn(),
      },
    },
    tabs: {
      query: jest.fn((queryInfo, callback) => {
        callback([]);
      }),
      sendMessage: jest.fn(),
    },
  };
};

export default createChromeMock();
```

### 1️⃣1️⃣ Criar `README.md`

Arquivo: `README.md`

```markdown
# Video Downloader Extension

A Chrome extension to download HLS and DASH streaming videos with TDD methodology.

## Setup

\`\`\`bash
npm install
npm test
npm run build
\`\`\`

## Development

\`\`\`bash
npm run dev         # Watch mode
npm test:watch      # Test watch mode
\`\`\`

## Loading Extension

1. Go to \`chrome://extensions/\`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the \`downloader\` directory

## Architecture

- **Service Worker**: Intercepts network requests, captures video URLs
- **Content Script**: Scans page DOM for video tags
- **Popup UI**: Lists detected videos and manages downloads
- **Utils**: HLS/DASH parsers, FFmpeg integration, download manager

## Testing

All code follows TDD: tests are written BEFORE implementation.

\`\`\`bash
npm test                # Run all tests
npm test:watch          # Watch mode
npm run test:coverage   # Coverage report
\`\`\`

Target: >80% coverage

## Stack

- **Build**: Webpack
- **Testing**: Jest + Testing Library
- **Media Processing**: FFmpeg.wasm
- **Manifest**: V3 (Chrome/Edge native)
```

### 1️⃣2️⃣ Verificação Final

```bash
# Testar se Jest está funcionando
npm test

# Testar se ESLint está ok
npm run lint

# Testar se build funciona
npm run build
```

Esperado:
- ✅ Jest roda e mostra: "No tests found"
- ✅ ESLint não retorna erros críticos
- ✅ Webpack cria pasta `dist/` com os bundles

---

## Fase 1: Filtros & Extensões de Mídia (Sprint 1)

### 1.1 [RED] Escrever Testes para Media Extensions
- [x] Criar `__tests__/media-extensions.test.js`:
  - Teste: `isMediaURL(".mp4")` retorna `true`
  - Teste: `isMediaURL(".webm")` retorna `true`
  - Teste: `isMediaURL(".m3u8")` retorna `true`
  - Teste: `isMediaURL(".mpd")` retorna `true`
  - Teste: `isMediaURL(".ts")` retorna `true` (segmento HLS)
  - Teste: `isMediaURL(".m4s")` retorna `true` (segmento DASH)
  - Teste: `isMediaURL(".txt")` retorna `false`
  - Teste: `getMediaType(".m3u8")` retorna `"hls"`
  - Teste: `getMediaType(".mpd")` retorna `"dash"`
  - Teste: `getMediaType(".mp4")` retorna `"video-simple"`
- [x] Expectativa: TODOS os testes falham (arquivo não existe)

### 1.2 [GREEN] Implementar Media Extensions
- [x] Criar `src/utils/media-extensions.js`:
  - Exportar objeto `MEDIA_EXTENSIONS` com lista de extensões e tipos
  - Função `isMediaURL(url)` - verifica se URL contém extensão de mídia
  - Função `getMediaType(url)` - retorna tipo (hls, dash, video-simple, fragment)
  - Função `cleanUrl(url)` - remove query params e fragmentos
- [x] Rodar testes: todos PASSAM

### 1.3 [REFACTOR] Otimizar Media Extensions
- [x] Adicionar suporte a URLs com query params: `video.mp4?token=xyz`
- [x] Adicionar suporte case-insensitive
- [x] Melhorar performance com regex compilado
- [x] Adicionar mais extensões se necessário (`.mov`, `.flv`, etc.)
- [x] Rodar testes: todos AINDA PASSAM ✅

---

## Fase 2: HLS Parser (Sprint 1-2)

### 2.1 [RED] Escrever Testes para HLS Parser
- [x] Criar `__tests__/hls-parser.test.js`:
  - Teste: `parseHLS(simpleM3U8)` retorna lista com URLs corretos
  - Teste: `parseHLS(withQualities)` identifica múltiplas qualidades (1080p, 720p, 480p)
  - Teste: `parseHLS(withEncryption)` retorna info de chave EXT-X-KEY
  - Teste: lidar com URLs relativas: `/playlist/segment-1.ts` → resolve relativo à URL base
  - Teste: lidar com URLs absolutas
  - Teste: ignorar comentários e linhas vazias
  - Teste: extrair duração total (EXT-X-DURATION)
  - Teste: parser não quebra com M3U8 malformado (edge cases)
- [x] Usar fixtures: `__tests__/fixtures/simple.m3u8`, `variants.m3u8`, `encrypted.m3u8`, `with-duration.m3u8`, `relative-urls.m3u8`, `malformed.m3u8`
- [x] Expectativa: testes passam ✅

### 2.2 [GREEN] Implementar HLS Parser
- [x] Criar `src/utils/hls-parser.js`:
  - Função `parseHLS(m3u8Content, baseUrl)` 
  - Parse linha por linha
  - Extrair tags: `#EXT-X-STREAM-INF`, `#EXT-X-KEY`, `#EXT-X-DURATION`
  - Retornar objeto: `{ streams: [{url, duration}], variants: [{bandwidth, resolution, url}], duration, keyInfo }`
  - Resolver URLs relativas usando `new URL()`
- [x] Rodar testes: todos PASSAM ✅

### 2.3 [REFACTOR] Otimizar HLS Parser
- [x] Adicionar seletor de qualidade: `selectQuality(variants, preference)`
- [x] Adicionar suporte a variantPlaylists (múltiplos streams com diferentes res)
- [x] Tratar edge cases: playlists sem tags, duplas quebras de linha
- [x] Adicionar logging para debug (com flag DEBUG_HLS_PARSER)
- [x] Adicionar funções utilitárias: `getSegmentUrls()`, `getTotalDuration()`, `isEncrypted()`, `getAvailableResolutions()`
- [x] Melhorar tratativa de URLs relativas (./, ../) e absolutas
- [x] Rodar testes: todos AINDA PASSAM ✅
- [x] ✅ Fase 2 concluída: HLS Parser totalmente implementado e testado

---

## Fase 3: DASH Parser (Sprint 2)

### 3.1 [RED] Escrever Testes para DASH Parser
- [x] Criar `__tests__/dash-parser.test.js`:
  - Teste: `parseDALE(mpd)` extrai representações (video, audio)
  - Teste: extrai URLs de segmentos ($Number$, $Time$)
  - Teste: lida com múltiplas qualidades (diferentes bitrates)
  - Teste: resolve URLs relativas vs. absolutas
  - Teste: extrai informação de duração
  - Teste: lidar com `<SegmentTimeline>` (timestamps explícitos)
  - Teste: suportar `<SegmentTemplate>` com media pattern
  - Teste: parser não quebra com MPD malformado
- [x] Usar fixture: `__tests__/fixtures/sample.mpd` (real DASH manifest)
- [x] Expectativa: testes falham ✅

### 3.2 [GREEN] Implementar DASH Parser
- [x] Criar `src/utils/dash-parser.js`:
  - Função `parseDALE(mpdContent, baseUrl, options)` ✅
  - Parse XML usando `DOMParser()` (disponível em browsers) ✅
  - Iterar sobre `<Representation>` dentro de `<AdaptationSet>` ✅
  - Extrair `<SegmentTemplate>` ou `<SegmentList>` ✅
  - Expandir URIs de template (ex: `media=$Number$.m4s` → `segment1.m4s`, `segment2.m4s`, etc.) ✅
  - Retornar: `{ representations: [{bitrate, url, duration, width, height, lang}], mediaDuration, isLive }` ✅
- [x] Rodar testes: todos PASSAM ✅

### 3.3 [REFACTOR] Otimizar DASH Parser
- [x] Suporte a `SegmentTimeline` com timestamps dinâmicos ✅
- [x] Seletor de qualidade/bitrate (`selectQuality`) - suporta 'low', 'medium', 'high', numeric bitrate ✅
- [x] Tratamento de período dinâmico (Live DASH) - detecta tipo="dynamic" ✅
- [x] Caching de parsed manifests - Map-based manifest cache ✅
- [x] Adicionar funções utilitárias: `clearManifestCache()`, `isLiveStream()`, `getAvailableCodecs()` ✅
- [x] Melhorar geração de URLs de segmentos ✅
- [x] Rodar testes: todos AINDA PASSAM ✅
- [x] ✅ Fase 3 concluída: DASH Parser totalmente implementado e testado

---

## Fase 4: Fragment Downloader (Sprint 2-3)

### 4.1 [RED] Escrever Testes para Fragment Downloader
- [x] Criar `__tests__/fragment-downloader.test.js`:
  - Teste: `downloadFragments(urlList)` retorna array de Blobs
  - Teste: parallelismo (fetch múltiplas URLs concorrentemente)
  - Teste: retry com exponential backoff em falha
  - Teste: máximo de 3 tentativas por fragmento
  - Teste: timeout após 30s por fragmento
  - Teste: progress callback é chamado: `onProgress(current, total, percent)`
  - Teste: falha em fragmento não quebra download de outros
  - Teste: retorna `{blobs, failedUrls, errors}` ao final
- [x] Mock fetch inline (jest.fn()) — sem dependência externa
- [x] Expectativa: testes falham ✅

### 4.2 [GREEN] Implementar Fragment Downloader
- [x] Criar `src/utils/fragment-downloader.js`:
  - Função `downloadFragments(urls, options={maxRetries:3, timeout:30000, maxParallel:6})`
  - Usar `fetch()` para fazer download de cada URL
  - Implementar retry com setTimeout + exponential backoff
  - Manter um pool de requests paralelas (não bombardear servidor)
  - Chamar callback `onProgress` a cada fragmento concluído
  - Retornar: `{blobs: Blob[], failedUrls: string[], errors: {}}`
- [x] Rodar testes: todos PASSAM ✅

### 4.3 [REFACTOR] Otimizar Fragment Downloader
- [x] Validar integridade de fragmentos (size via `validateSize` option)
- [x] Adicionar teste de performance (1000 fragmentos) — passa em ~28ms
- [x] AbortController para timeout por tentativa (sem race conditions)
- [x] Pool-based concurrency com processNext() (não promete Race)
- [x] `retryDelay` configurável para facilitar testes
- [x] Rodar testes: todos AINDA PASSAM ✅ (17 testes, 131 total)
- [x] ✅ Fase 4 concluída: Fragment Downloader totalmente implementado e testado

---

## Fase 5: FFmpeg Concatenator (Sprint 3)

### 5.1 [RED] Escrever Testes para FFmpeg Concatenator
- [ ] Criar `__tests__/ffmpeg-concatenator.test.js`:
  - Teste: `concatenateFragments(blobArray)` retorna Blob (arquivo .mp4)
  - Teste: suporta múltiplos tipos: `.ts`, `.m4s` (sem conversão necessária)
  - Teste: metadados do arquivo de saída são válidos (duration, codec)
  - Teste: arquivo gerado é playable (pelo menos headers válidos)
  - Teste: lidar com arquivo grande (simular 100MB+)
  - Teste: erro em FFmpeg.wasm pode ser capturado com try/catch
- [ ] Mock FFmpeg.wasm: criar `__tests__/mocks/ffmpeg.mock.js`
- [ ] Expectativa: testes falham

### 5.2 [GREEN] Implementar FFmpeg Concatenator
- [ ] Criar `src/utils/ffmpeg-concatenator.js`:
  - Função `concatenateFragments(blobs, outputFormat="mp4")`
  - Carregar FFmpeg.wasm (lazy-load apenas quando necessário)
  - Escrever fragmentos em filesystem virtual do FFmpeg
  - Executar comando: `ffmpeg -i concat:segment1.ts|segment2.ts -c copy output.mp4`
  - Ler arquivo de saída como Blob
  - Retornar: `Blob` do arquivo MP4 final
- [ ] Rodar testes: todos PASSAM (com mock)

### 5.3 [REFACTOR] Otimizar FFmpeg Concatenator
- [ ] Usar Web Worker para não bloquear main thread
- [ ] Adicionar suporte a cancelamento
- [ ] Melhorar feedback de progresso (% de concatenação)
- [ ] Cache do FFmpeg.wasm carregado
- [ ] Rodar testes: todos AINDA PASSAM ✅

---

## Fase 6: Download Manager (Sprint 3)

### 6.1 [RED] Escrever Testes para Download Manager
- [ ] Criar `__tests__/download-manager.test.js`:
  - Teste: `downloadBlob(blob, filename)` invoca `chrome.downloads.download()`
  - Teste: `generateFilename(videoUrl, type)` gera nome único: `video_20260310_1080p.mp4`
  - Teste: detectar conflito de nome e adicionar sufixo: `video_20260310_1080p (1).mp4`
  - Teste: sanitizar nome (remover caracteres inválidos)
  - Teste: suportar tipos: "hls", "dash", "simple"
  - Teste: gerar metadados: timestamp, qualidade, tipo
  - Teste: mock chrome.downloads retorna ID do download
- [ ] Mock: `chrome.downloads` API
- [ ] Expectativa: testes falham

### 6.2 [GREEN] Implementar Download Manager
- [ ] Criar `src/utils/download-manager.js`:
  - Função `downloadBlob(blob, filename, options={})`
  - Usar `chrome.downloads.download({url: blobUrl, filename, saveAs: false})`
  - Função `generateFilename(baseUrl, type, quality="unknown")`
  - Usar timestamp + qualidade: `video_${date}_${quality}.mp4`
  - Sanitização simples (regex remover caracteres inválidos)
  - Retornar: `downloadId` (inteiro)
- [ ] Rodar testes: todos PASSAM

### 6.3 [REFACTOR] Otimizar Download Manager
- [ ] Adicionar customização de diretório via storage
- [ ] Melhorar sanitização de nome (Unicode, etc.)
- [ ] Adicionar resumption support (se servidor permite)
- [ ] Tracking de status: armazenar em storage
- [ ] Rodar testes: todos AINDA PASSAM ✅

---

## Fase 7: Service Worker (Sprint 3-4)

### 7.1 [RED] Escrever Testes para Service Worker
- [ ] Criar `__tests__/service-worker.test.js`:
  - Teste: listener `chrome.webRequest.onBeforeRequest` captura URLs `.m3u8`, `.mpd`
  - Teste: armazena URL em `chrome.storage.local`
  - Teste: message handler `"GET_VIDEOS"` retorna lista do storage
  - Teste: message handler `"ADD_VIDEO"` adiciona URL com deduplicação
  - Teste: deduplicação funciona (mesma URL não é adicionada 2x)
  - Teste: message handler `"CLEAR_VIDEOS"` limpa storage
  - Teste: listener de storage mantém Popup sincronizado
- [ ] Mock: `chrome.webRequest`, `chrome.storage`, `chrome.runtime.onMessage`
- [ ] Expectativa: testes falham

### 7.2 [GREEN] Implementar Service Worker
- [ ] Criar `src/background/service-worker.js`:
  - `chrome.webRequest.onBeforeRequest.addListener()` para capturar requests
  - Filtrar por extensão de mídia usando `media-extensions.js`
  - Armazenar em `chrome.storage.local` com deduplicação (Set)
  - Handlers de mensagem:
    - `"GET_VIDEOS"` → retorna lista atual
    - `"ADD_VIDEO"` → adiciona nova URL (via Content Script)
    - `"CLEAR_VIDEOS"` → limpa tudo
    - `"DOWNLOAD_VIDEO"` → inicia download (chamar download-manager)
  - Broadcast atualizações para Popup via `chrome.runtime.sendMessage()`
- [ ] Rodar testes: todos PASSAM

### 7.3 [REFACTOR] Otimizar Service Worker
- [ ] Adicionar persistência entre sessões (storage já feito)
- [ ] Melhorar logging para debug
- [ ] Adicionar timestamp de quando cada vídeo foi detectado
- [ ] Rodar testes: todos AINDA PASSAM ✅

---

## Fase 8: Content Script (Sprint 4)

### 8.1 [RED] Escrever Testes para Content Script
- [ ] Criar `__tests__/content-script.test.js`:
  - Teste: `findVideoElements(doc)` encontra todas `<video src="">`
  - Teste: `findVideoElements(doc)` encontra `<video><source src="">`
  - Teste: extrai atributos: `src`, `type`
  - Teste: ignora videos sem src
  - Teste: deduplicação de URLs
  - Teste: MutationObserver detecta novos vídeos adicionados ao DOM
  - Teste: envia mensagem ao Service Worker via `chrome.runtime.sendMessage()`
- [ ] Mock: `document`, `chrome.runtime`, `MutationObserver`
- [ ] Expectativa: testes falham

### 8.2 [GREEN] Implementar Content Script
- [ ] Criar `src/content/content-script.js`:
  - Função `findVideoElements()`
  - Buscar `document.querySelectorAll('video')`
  - Extrair `src` de `<video>` ou `<source>` filhos
  - Deduplicate URLs
  - Enviar ao Service Worker: `chrome.runtime.sendMessage({type: "ADD_VIDEO", url, source: "dom"})`
  - Setup `MutationObserver` para detect novos videos adicionados dinamicamente
  - Executar ao carregar + observar mudanças
- [ ] Rodar testes: todos PASSAM

### 8.3 [REFACTOR] Otimizar Content Script
- [ ] Melhorar seletor de vídeos (considerar iframes, shadow DOM)
- [ ] Adicionar suporte a data attributes customizados
- [ ] Otimizar MutationObserver (não observar tudo, only relevant nodes)
- [ ] Rodar testes: todos AINDA PASSAM ✅

---

## Fase 9: Popup UI (Sprint 4)

### 9.1 [RED] Escrever Testes para Popup Logic
- [ ] Criar `__tests__/popup.test.js`:
  - Teste: `getVideoList()` busca do storage e retorna array
  - Teste: `renderVideoList(videos)` gera HTML com lista de vídeos
  - Teste: clique em "Baixar" invoca `downloadVideo(url)`
  - Teste: `downloadVideo(url)` com HLS detecta tipo e chama parser
  - Teste: `downloadVideo(url)` com MP4 simples faz download direto
  - Teste: barra de progresso atualiza durante download
  - Teste: mensagem de sucesso/erro é exibida
  - Teste: botão "Limpar" invoca `clearVideos()`
- [ ] Mock: `chrome.storage`, `chrome.runtime.sendMessage`, DOM
- [ ] Expectativa: testes falham

### 9.2 [GREEN] Implementar Popup UI
- [ ] Criar `src/popup/popup.html`:
  - Lista `<ul id="video-list">` (preenchida pela JS)
  - Botão "Baixar" para cada vídeo
  - Botão "Limpar tudo"
  - Barra de progresso `<progress>`
  - Área de status (sucesso/erro)
  
- [ ] Criar `src/popup/popup.css`:
  - Estilos básicos (list, buttons, progress bar)
  
- [ ] Criar `src/popup/popup.js`:
  - `getVideoList()` → buscar do storage
  - `renderVideoList(videos)` → preencher lista
  - Event listeners: clique em "Baixar", "Limpar"
  - `downloadVideo(url)` → detectar tipo → chamar Service Worker com `sendMessage`
  - Listeners de resposta do Service Worker para atualizar progress e status
  
- [ ] Rodar testes: todos PASSAM

### 9.3 [REFACTOR] Otimizar Popup UI
- [ ] Melhorar UX: ícones, melhor feedback visual
- [ ] Adicionar filtros (HLS, DASH, MP4)
- [ ] Ordem de vídeos (mais recente primeiro)
- [ ] Rodar testes: todos AINDA PASSAM ✅

---

## Fase 10: Testes de Integração (E2E) (Sprint 4-5)

### 10.1 [RED] Escrever Testes E2E
- [ ] Criar `__tests__/e2e.test.js`:
  - Setup: Puppeteer para abrir Chrome com extensão
  - Teste: navegar para site com HLS → capturar URL → listar no Popup → baixar
  - Teste: navegar para site com DASH → idem
  - Teste: navegar para site com video simples .mp4 → idem
  - Teste: arquivo final é válido (headers de vídeo OK, size razoável)
  - Teste: múltiplos vídeos na mesma página
  - Teste: reutilização de fragmento (mesmo segmento em múltiplos videos)
- [ ] Setup: mock server com vídeos reais (ou usar sample fixtures)
- [ ] Expectativa: testes falham (não há implementação integrada ainda)

### 10.2 [GREEN] Integração End-to-End
- [ ] Rodar testes com todas as fases anteriores implementadas
- [ ] Debugar e corrigir bugs de integração
- [ ] Validar que downloads são salvos corretamente no filesystem
- [ ] Rodar testes: todos PASSAM ✅

### 10.3 [REFACTOR] Melhorar Testes E2E
- [ ] Adicionar cenários com múltiplos downloads paralelos
- [ ] Testar com sites reais (YouTube, Vimeo) se possível
- [ ] Performance testing: tempo total de download
- [ ] Rodar testes: todos AINDA PASSAM ✅

---

## Fase 11: Vídeos Simples (MP4/WebM) - Segunda Prioridade (Sprint 5)

### 11.1 [RED] Escrever Testes para Vídeos Simples
- [ ] Criar `__tests__/simple-video-download.test.js`:
  - Teste: `detectVideoType(".mp4")` retorna `"simple"`
  - Teste: `downloadSimpleVideo(url)` faz fetch e retorna Blob
  - Teste: suportar múltiplas extensões: `.mp4`, `.webm`, `.mov`
  - Teste: valida MIME type da resposta
  - Teste: progress callback funciona
  - Teste: retry em falha
- [ ] Expectativa: testes falham

### 11.2 [GREEN] Implementar Vídeos Simples
- [ ] Estender `src/utils/download-manager.js`:
  - Função `downloadSimpleVideo(url, onProgress)`
  - Fetch direto sem estar HLS/DASH
  - Reportar progresso via onProgress
  - Retornar Blob
- [ ] Estender `src/popup/popup.js`:
  - Detectar tipo de URL (HLS vs DASH vs simples)
  - Router para HLS parser → fragmentos → FFmpeg vs direto
- [ ] Rodar testes: todos PASSAM

### 11.3 [REFACTOR] Otimizar
- [ ] Suporte a resumption (Range headers)
- [ ] Melhor deteção de tipo (MIME headers vs. extensão)
- [ ] Rodar testes: todos AINDA PASSAM ✅

---

## Fase 12: Coverage Audit & Polish (Sprint 5)

### 12.1 Verificar Cobertura de Testes
- [ ] Rodar: `npm test -- --coverage`
- [ ] Target: >80% coverage geral, >90% em lógica crítica
- [ ] Identificar código não testado
- [ ] Adicionar testes faltantes se cobertura < 80%

### 12.2 Documentação de Testes
- [ ] Criar `TESTING.md`:
  - Como rodar testes
  - Explicação de cada test suite
  - Fixtures disponíveis e como usá-las
  - Padrão de mocks
  - Como debugar testes

### 12.3 Verificação de Performance
- [ ] Build size: FFmpeg.wasm + código → tamanho final
- [ ] Otimizar bundle (tree-shake, minify)
- [ ] Profile: tempo de startup, de download, memória

### 12.4 Polish Final
- [ ] Código sem warnings de lint
- [ ] Nomes descritivos em todos os arquivos
- [ ] Comments úteis (não óbvios)
- [ ] README completo com screenshots (placeholders ok por enquanto)

---

## 📋 Matriz de Arquivos a Criar

```
downloader/
├── .gitignore
├── package.json
├── jest.config.js
├── webpack.config.js
├── .eslintrc.json
├── .babelrc
├── README.md (base)
├── TESTING.md (após Phase 12)
│
├── __tests__/
│   ├── jest.setup.js (mocks globais)
│   ├── fixtures/
│   │   ├── sample.m3u8
│   │   ├── sample.mpd
│   │   └── ...
│   ├── mocks/
│   │   ├── chrome-api.js
│   │   └── ffmpeg.mock.js
│   ├── media-extensions.test.js
│   ├── hls-parser.test.js
│   ├── dash-parser.test.js
│   ├── fragment-downloader.test.js
│   ├── ffmpeg-concatenator.test.js
│   ├── download-manager.test.js
│   ├── service-worker.test.js
│   ├── content-script.test.js
│   ├── popup.test.js
│   ├── simple-video-download.test.js
│   └── e2e.test.js
│
├── src/
│   ├── utils/
│   │   ├── media-extensions.js
│   │   ├── hls-parser.js
│   │   ├── dash-parser.js
│   │   ├── fragment-downloader.js
│   │   ├── ffmpeg-concatenator.js
│   │   └── download-manager.js
│   ├── background/
│   │   └── service-worker.js
│   ├── content/
│   │   └── content-script.js
│   └── popup/
│       ├── popup.html
│       ├── popup.css
│       └── popup.js
│
├── public/
│   └── icons/
│       ├── icon-16.png
│       ├── icon-48.png
│       └── icon-128.png
│
└── manifest.json
```

---

## 🔄 Workflow para Cada Task

1. **Começar com [RED]**: Escrever teste que FALHA explicitamente
2. **Rodar teste**: Confirmar que falha (`npm test -- --testNamePattern="..."`)
3. **Implementar [GREEN]**: Código mínimo para PASSAR
4. **Rodar teste**: Confirmar que PASSA (`npm test -- --testNamePattern="..."`)
5. **[REFACTOR]**: Melhorar sem quebrar testes
6. **Rodar suite completa**: `npm test` - todos devem passar
7. **Commit**: Fazer commit com mensagem: "feat: [module] - [RED/GREEN/REFACTOR]"

---

## ⏱️ Estimativa de Tempo (TDD-adjusted)

| Fase | Sprint | Tasks | Complexidade | Dias Estimados | % Trabalho | 
|------|--------|-------|---|---|---|
| 0 | 0 | 6 | Baixa | 1-2 | 5% |
| 1 | 1 | 6 | Baixa | 1-2 | 5% |
| 2 | 1-2 | 9 | Média | 2-3 | 10% |
| 3 | 2 | 9 | Média | 2-3 | 10% |
| 4 | 2-3 | 9 | Média-Alta | 2-3 | 10% |
| 5 | 3 | 9 | Alta | 3-4 | 15% |
| 6 | 3 | 9 | Média | 2-3 | 10% |
| 7 | 3-4 | 9 | Média | 2-3 | 10% |
| 8 | 4 | 9 | Média | 2-2.5 | 8% |
| 9 | 4 | 9 | Média | 2-3 | 10% |
| 10 | 4-5 | 9 | Alta | 2-3 | 8% |
| 11 | 5 | 9 | Baixa | 1-2 | 4% |
| 12 | 5 | 4 | Baixa | 1 | 2% |
| **TOTAL** | **0-5** | **118 sub-tasks** | **Média-Alta** | **24-35 dias** | **100%** |

**Observação**: TDD aumenta tempo inicial (mais testes) mas reduz refatoração futura. Bug density diminui significativamente.

---

## ✅ Critérios de Aceitação (Fase por Fase)

**Phase 0**: Jest rodando, webpack compilando, mocks de Chrome API funcionando
**Phase 1**: Todos os testes em `media-extensions.test.js` passando
**Phase 2-3**: HLS/DASH parsers testados com fixtures reais
**Phase 4-5**: Download de fragmentos + FFmpeg funcionando em testes
**Phase 6**: Download Manager salva arquivos corretamente
**Phase 7-8**: Service Worker + Content Script comunicando via mensagens
**Phase 9**: Popup exibindo lista e permitindo downloads
**Phase 10**: E2E completo: rede → storage → download → arquivo no disco
**Phase 11**: Vídeos simples também funcionando
**Phase 12**: Coverage >80%, documentação completa

---

## 🚀 Como Começar

```bash
# 1. Phase 0 Setup
npm init -y
npm install jest @testing-library/dom webpack webpack-cli babel-loader eslint @babel/core @babel/preset-env --save-dev
npm install @ffmpeg/ffmpeg

# 2. Criar jest.config.js, webpack.config.js, .eslintrc.json

# 3. Começar Phase 1: Red
npm test -- --testNamePattern="isMediaURL"
# (falha ✗)

# 4. Green
# Criar src/utils/media-extensions.js

# 5. Test
npm test -- --testNamePattern="isMediaURL"
# (passa ✓)

# 6. Refactor + commit
git add .
git commit -m "feat: media-extensions - [GREEN] implement isMediaURL"

# 7. Próxima task...
```

---

## 📝 Notes

- **TDD mindset**: Comportamento esperado (test) ANTES de implementação
- **Coverage matters**: >80% garante refactors seguros no futuro
- **Mock Chrome APIs**: Fundamental para testar sem depender de Chrome
- **Fixtures são ouro**: Reusar sampe.m3u8, sample.mpd reais
- **Commit frequente**: Um commit por RED/GREEN/REFACTOR cycle
