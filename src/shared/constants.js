// Storage keys
export const STORAGE_KEYS = {
  FEED_ITEMS: 'feedme:items',
  READ_POSITION: 'feedme:readPosition',
  BLUESKY_SESSION: 'feedme:bskySession',
  SETTINGS: 'feedme:settings',
};

// Message types (content script ↔ service worker ↔ panel)
export const MSG = {
  X_FEED_DATA: 'X_FEED_DATA',
  GET_FEED: 'GET_FEED',
  GET_READ_POSITION: 'GET_READ_POSITION',
  SET_READ_POSITION: 'SET_READ_POSITION',
  GET_SETTINGS: 'GET_SETTINGS',
  SAVE_SETTINGS: 'SAVE_SETTINGS',
  LOGIN_BLUESKY: 'LOGIN_BLUESKY',
  LOGOUT_BLUESKY: 'LOGOUT_BLUESKY',
  FEED_UPDATED: 'FEED_UPDATED',
};

// Bluesky defaults
export const BSKY_SERVICE = 'https://bsky.social';
export const BSKY_PUBLIC_API = 'https://public.api.bsky.app';

// Feed limits
export const MAX_FEED_ITEMS = 500;
export const BSKY_POLL_INTERVAL_MIN = 2;

// X.com GraphQL endpoints to intercept
export const X_TIMELINE_ENDPOINTS = [
  'HomeTimeline',
  'HomeLatestTimeline',
];

// Alarm names
export const ALARMS = {
  BSKY_POLL: 'feedme:bskyPoll',
  BSKY_TOKEN_REFRESH: 'feedme:bskyTokenRefresh',
};
