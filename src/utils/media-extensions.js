/**
 * Media Extensions Utility
 * 
 * Responsabilidades:
 * - Detectar tipo de mídia (HLS, DASH, vídeo simples, stream)
 * - Validar URLs de mídia
 * - Limpar URLs (remover query params e fragmentos)
 * - Manter lista de extensões conhecidas
 */

/**
 * Extensões de mídia suportadas organizadas por tipo
 */
export const MEDIA_EXTENSIONS = {
  video: ['.mp4', '.webm', '.mov', '.mkv', '.avi', '.flv', '.wmv', '.m4v'],
  audio: ['.mp3', '.aac', '.wav', '.ogg', '.wma', '.m4a', '.flac'],
  hls: ['.m3u8', '.m3u'],
  dash: ['.mpd'],
  stream: ['.ts', '.m4s', '.seg', '.f4v'],
};

/**
 * Cria um mapa de regex para detecção rápida
 */
const extensionMap = new Map();

Object.entries(MEDIA_EXTENSIONS).forEach(([type, exts]) => {
  exts.forEach((ext) => {
    extensionMap.set(ext.toLowerCase(), type);
  });
});

/**
 * Extrai a extensão de uma URL (antes de query params ou fragmentos)
 * @param {string} url - URL a processar
 * @returns {string} Extensão em minúsculas com ponto (ex: ".mp4"), ou string vazia
 */
function getExtension(url) {
  if (!url) return '';

  // Remove fragmentos e query strings
  const cleanedUrl = url.split('?')[0].split('#')[0];

  // Extrai a extensão
  const match = cleanedUrl.match(/\.[a-zA-Z0-9]+$/);
  return match ? match[0].toLowerCase() : '';
}

/**
 * Verifica se uma URL é de mídia conhecida
 * @param {string} url - URL a verificar
 * @returns {boolean} true se URL contém extensão de mídia
 */
export function isMediaURL(url) {
  if (!url || typeof url !== 'string') return false;

  const ext = getExtension(url);
  return extensionMap.has(ext);
}

/**
 * Retorna o tipo de mídia de uma URL
 * @param {string} url - URL a analisar
 * @returns {string} Tipo de mídia: 'hls', 'dash', 'video', 'audio', 'stream', ou 'unknown'
 */
export function getMediaType(url) {
  if (!url || typeof url !== 'string') return 'unknown';

  const ext = getExtension(url);
  return extensionMap.get(ext) || 'unknown';
}

/**
 * Remove query parameters e fragmentos de uma URL
 * @param {string} url - URL a limpar
 * @returns {string} URL sem query params ou fragmentos
 */
export function cleanUrl(url) {
  if (!url || typeof url !== 'string') return '';

  // Remove query parameters e fragmentos mantendo a URL base
  return url.split('?')[0].split('#')[0];
}

/**
 * Seleciona extensões de um tipo específico
 * @param {string} type - Tipo de mídia a retornar
 * @returns {string[]} Array de extensões
 */
export function getExtensionsByType(type) {
  return MEDIA_EXTENSIONS[type] || [];
}

/**
 * Valida se uma URL é uma playlist (HLS ou DASH)
 * @param {string} url - URL a verificar
 * @returns {boolean} true se é playlist
 */
export function isPlaylistURL(url) {
  const type = getMediaType(url);
  return type === 'hls' || type === 'dash';
}

/**
 * Valida se uma URL é um vídeo simples (não streaming)
 * @param {string} url - URL a verificar
 * @returns {boolean} true se é vídeo simples
 */
export function isSimpleVideoURL(url) {
  const type = getMediaType(url);
  return type === 'video';
}

/**
 * Valida se uma URL é um segmento de stream
 * @param {string} url - URL a verificar
 * @returns {boolean} true se é segmento
 */
export function isStreamSegmentURL(url) {
  const type = getMediaType(url);
  return type === 'stream';
}

export default {
  MEDIA_EXTENSIONS,
  isMediaURL,
  getMediaType,
  cleanUrl,
  getExtensionsByType,
  isPlaylistURL,
  isSimpleVideoURL,
  isStreamSegmentURL,
};
