# Especificação do Projeto: Extensão de Download de Vídeo

## 1. Visão Geral
Uma extensão de navegador baseada em Manifest V3 projetada para detectar, processar e baixar arquivos de vídeo em execução na aba ativa do usuário. A extensão funcionará interceptando o tráfego de rede e inspecionando o DOM da página.

## 2. Arquitetura do Sistema

* **Manifest (`manifest.json`):** Arquivo de configuração que define as propriedades da extensão, permissões e aponta para os scripts de execução.
* **Background Script (Service Worker):** Script persistente que monitora as requisições de rede globalmente. Responsável pela lógica de interceptação de mídia.
* **Content Script:** Script injetado no contexto da página da web atual. Responsável por ler o DOM e identificar elementos `<video>`.
* **Popup UI:** Interface de usuário interativa (HTML/CSS/JS) acionada ao clicar no ícone da extensão, exibindo a lista de vídeos detectados na aba atual.

## 3. Funcionalidades Principais
* **Detecção via Rede:** O Service Worker filtra requisições HTTP em tempo real, capturando URLs que contenham extensões de mídia alvo (ex: `.mp4`, `.webm`, `.m3u8`).
* **Detecção via DOM (Fallback):** O Content Script varre a página em busca de tags nativas de vídeo e extrai seus atributos `src`.
* **Processamento de Streaming (HLS/DASH):** Capacidade de ler arquivos de playlist (`.m3u8`), realizar o download em lote de fragmentos de vídeo (`.ts`) e concatená-los em um único arquivo `.mp4` na memória.
* **Módulo de Download:** Integração com a API de downloads do navegador para transferir o arquivo processado para o sistema de arquivos local do usuário.

## 4. Requisitos de Permissões
As seguintes permissões devem ser declaradas no `manifest.json`:
* `webRequest`: Essencial para analisar o tráfego de rede em busca de mídias.
* `downloads`: Necessária para salvar o arquivo final na máquina do usuário.
* `activeTab`: Permite injetar o Content Script na aba atual.
* `host_permissions` (`<all_urls>` ou domínios específicos): Necessário para interceptar tráfego de qualquer site navegado.

## 5. Stack Tecnológico
* **Linguagem:** JavaScript (ES6+).
* **Interface:** HTML5 e CSS3.
* **Processamento de Mídia:** FFmpeg.wasm (para compilação e concatenação de fragmentos HLS diretamente no navegador, sem uso de backend).