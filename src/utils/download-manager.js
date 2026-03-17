/**
 * Download Manager
 *
 * Responsabilidades:
 * - Gerenciar downloads de vídeos (HLS, DASH, simples)
 * - Gerar nomes de arquivo com formato consistente
 * - Sanitizar nomes para evitar caracteres inválidos
 * - Gerenciar diretório de download
 * - Rastrear status de downloads
 * - Implementar retry logic para downloads simples
 */

import { getMediaType } from './media-extensions.js';

const DEFAULT_DOWNLOAD_DIR = 'Downloads';
const INVALID_FILENAME_CHARS = /[<>:"|\\/?*]/g;
const MAX_RETRIES = 3;
const TIMEOUT_MS = 30000;

/**
 * Remove caracteres inválidos do nome do arquivo
 * @param {string} filename - Nome original
 * @returns {string} Nome sanitizado
 */
export function sanitizeFilename(filename) {
  if (!filename || typeof filename !== 'string') return '';

  return filename
    .trim()
    .replace(INVALID_FILENAME_CHARS, '')
    .replace(/\s+/g, ' ');
}

/**
 * Gera nome de arquivo padronizado: video_YYYYMMDD_quality.ext
 * @param {string} baseUrl - URL original do vídeo
 * @param {string} type - Tipo de mídia (hls, dash, simple)
 * @param {string} quality - Qualidade (ex: 1080p, 720p)
 * @returns {string} Nome do arquivo
 */
export function generateFilename(baseUrl, type, quality = '1080p') {
  if (!baseUrl || typeof baseUrl !== 'string') return 'video.mp4';

  // Extrair nome base da URL
  const urlObj = new URL(baseUrl);
  const pathname = urlObj.pathname;
  const parts = pathname.split('/');
  let baseName = parts[parts.length - 1] || 'video';

  // Extrair extensão original ANTES de remover
  const extensionMatch = baseName.match(/\.([a-zA-Z0-9]+)$/);
  const originalExtension = extensionMatch ? extensionMatch[1].toLowerCase() : null;

  // Remover extensão do nome base
  baseName = baseName.split('.')[0] || 'video';

  // Formatar data
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;

  // Determinar extensão
  let ext = 'mp4';
  if (type === 'simple' && originalExtension && ['webm', 'mov', 'mkv', 'avi', 'flv', 'wmv', 'm4v'].includes(originalExtension)) {
    ext = originalExtension;
  }

  const filename = `video_${dateStr}_${quality}.${ext}`;
  return sanitizeFilename(filename);
}

/**
 * Cria objeto de status de download
 * @param {string} downloadId - ID do download
 * @param {string} filename - Nome do arquivo
 * @returns {object} Status do download
 */
export function createDownloadStatus(downloadId, filename) {
  return {
    downloadId,
    filename,
    status: 'pending', // pending, downloading, completed, failed
    progress: 0, // 0-100
    timestamp: Date.now(),
  };
}

/**
 * Define o diretório de download
 * @param {string} dir - Caminho do diretório
 * @returns {Promise<void>}
 */
export async function setDownloadDirectory(dir) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(
      { downloadDirectory: dir },
      () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      }
    );
  });
}

/**
 * Obtém o diretório de download configurado
 * @returns {Promise<string>} Caminho do diretório
 */
export async function getDownloadDirectory() {
  return new Promise((resolve) => {
    chrome.storage.local.get('downloadDirectory', (result) => {
      resolve(result.downloadDirectory || DEFAULT_DOWNLOAD_DIR);
    });
  });
}

/**
 * Download um blob para o disco
 * @param {Blob} blob - Blob a fazer download
 * @param {string} filename - Nome do arquivo
 * @param {object} options - Opções de download
 * @returns {Promise<number>} ID do download
 */
export async function downloadBlob(blob, filename, options = {}) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);

    const downloadOptions = {
      url,
      filename,
      ...options,
    };

    chrome.downloads.download(downloadOptions, (downloadId) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        // Limpar URL object após começar o download
        setTimeout(() => URL.revokeObjectURL(url), 100);
        resolve(downloadId);
      }
    });
  });
}

/**
 * Implementa retry com backoff exponencial
 * @param {Function} fn - Função a executar
 * @param {number} maxRetries - Número máximo de tentativas
 * @param {number} baseDelayMs - Atraso base em ms
 * @returns {Promise} Resultado da função
 */
async function retryWithBackoff(fn, maxRetries = MAX_RETRIES, baseDelayMs = 1000) {
  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries - 1) {
        const delayMs = baseDelayMs * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError;
}

/**
 * Implementa timeout para promise
 * @param {Promise} promise - Promise a envolver
 * @param {number} timeoutMs - Timeout em ms
 * @returns {Promise} Promise com timeout
 */
function withTimeout(promise, timeoutMs) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), timeoutMs)
    ),
  ]);
}

/**
 * Download um vídeo simples (arquivo único, sem FFmpeg)
 * @param {string} url - URL do vídeo
 * @param {Function} onProgress - Callback de progresso
 * @returns {Promise<Blob>} Blob do vídeo
 */
export async function downloadSimpleVideo(url, onProgress) {
  const downloadFn = async () => {
    return await withTimeout(
      (async () => {
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        // Validar Content-Type
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.startsWith('video/')) {
          throw new Error(
            `Invalid Content-Type: ${contentType}. Expected video/*`
          );
        }

        // Obter tamanho total se disponível
        const contentLength = response.headers.get('content-length');
        const totalBytes = contentLength ? parseInt(contentLength, 10) : null;

        // Ler stream com progresso
        let downloadedBytes = 0;
        const chunks = [];

        if (response.body) {
          const reader = response.body.getReader();

          try {
            while (true) {
              const { done, value } = await reader.read();

              if (done) break;

              chunks.push(value);
              downloadedBytes += value.length;

              if (onProgress && totalBytes) {
                const percent = Math.min(100, Math.round((downloadedBytes / totalBytes) * 100));
                onProgress({
                  current: downloadedBytes,
                  total: totalBytes,
                  percent,
                });
              }
            }
          } finally {
            reader.releaseLock();
          }
        } else {
          // Fallback: usar blob() se body não disponível
          return response.blob();
        }

        // Combinar chunks e criar blob
        const blob = new Blob(chunks, { type: contentType });

        if (onProgress) {
          onProgress({
            current: downloadedBytes,
            total: downloadedBytes,
            percent: 100,
          });
        }

        return blob;
      })(),
      TIMEOUT_MS
    );
  };

  return retryWithBackoff(downloadFn, MAX_RETRIES);
}

export default {
  sanitizeFilename,
  generateFilename,
  createDownloadStatus,
  setDownloadDirectory,
  getDownloadDirectory,
  downloadBlob,
  downloadSimpleVideo,
};
