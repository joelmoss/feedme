// Storage keys
export const STORAGE_KEYS = {
  POSITION: 'feedme:position',
  HISTORY: 'feedme:history',
};

// Message types
export const MSG = {
  SAVE_POSITION: 'SAVE_POSITION',
  GET_POSITION: 'GET_POSITION',
  GET_HISTORY: 'GET_HISTORY',
  CLEAR_HISTORY: 'CLEAR_HISTORY',
  JUMP_TO_POSITION: 'JUMP_TO_POSITION',
  POSITION_UPDATED: 'POSITION_UPDATED',
};

// Config
export const IDLE_TIMEOUT_MS = 60_000; // 1 minute
export const MAX_HISTORY = 50;
export const MARKER_ID = 'feedme-marker';
