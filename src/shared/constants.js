// Per-site storage key helpers
export function storageKeyPosition(site) {
  return `feedme:${site}:position`;
}

export function storageKeyHistory(site) {
  return `feedme:${site}:history`;
}

export const SITES = ['x', 'bsky'];

// Message types
export const MSG = {
  SAVE_POSITION: 'SAVE_POSITION',
  GET_POSITION: 'GET_POSITION',
  GET_HISTORY: 'GET_HISTORY',
  CLEAR_HISTORY: 'CLEAR_HISTORY',
  JUMP_TO_POSITION: 'JUMP_TO_POSITION',
  POSITION_UPDATED: 'POSITION_UPDATED',
  GET_ACTIVE_SITE: 'GET_ACTIVE_SITE',
};

// Config
export const IDLE_TIMEOUT_MS = 30_000; // 30 seconds
export const MAX_HISTORY = 50;
export const MARKER_ID = 'feedme-marker';
