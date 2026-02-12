/**
 * Bluesky AT Protocol client for the service worker.
 * Handles authentication, session management, and timeline fetching.
 */

import { BskyAgent } from '@atproto/api';
import { BSKY_SERVICE, ALARMS, STORAGE_KEYS } from '../shared/constants.js';
import { storageGet, storageSet, storageRemove } from '../shared/storage.js';
import { normalizeBskyPost } from '../lib/normalizer.js';

let agent = null;

/**
 * Get or create the BskyAgent, restoring a saved session if available.
 */
async function getAgent() {
  if (agent) return agent;

  agent = new BskyAgent({ service: BSKY_SERVICE });

  // Try to restore saved session
  const saved = await storageGet(STORAGE_KEYS.BLUESKY_SESSION);
  if (saved) {
    try {
      await agent.resumeSession(saved);
    } catch {
      // Session expired — clear it, user needs to re-login
      await storageRemove(STORAGE_KEYS.BLUESKY_SESSION);
      agent = new BskyAgent({ service: BSKY_SERVICE });
    }
  }

  return agent;
}

/**
 * Log in with handle + app password.
 * Returns { success, error? }.
 */
export async function login(handle, appPassword) {
  try {
    agent = new BskyAgent({ service: BSKY_SERVICE });
    const res = await agent.login({ identifier: handle, password: appPassword });

    await storageSet(STORAGE_KEYS.BLUESKY_SESSION, {
      did: res.data.did,
      handle: res.data.handle,
      accessJwt: res.data.accessJwt,
      refreshJwt: res.data.refreshJwt,
    });

    // Set up token refresh alarm (refresh every 30 min, tokens last ~2h)
    chrome.alarms.create(ALARMS.BSKY_TOKEN_REFRESH, { periodInMinutes: 30 });

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message ?? 'Login failed' };
  }
}

/**
 * Log out and clear stored session.
 */
export async function logout() {
  agent = null;
  await storageRemove(STORAGE_KEYS.BLUESKY_SESSION);
  chrome.alarms.clear(ALARMS.BSKY_TOKEN_REFRESH);
}

/**
 * Refresh the access token using the refresh token.
 */
export async function refreshSession() {
  try {
    const a = await getAgent();
    if (!a.session) return;

    await a.resumeSession(a.session);

    await storageSet(STORAGE_KEYS.BLUESKY_SESSION, {
      did: a.session.did,
      handle: a.session.handle,
      accessJwt: a.session.accessJwt,
      refreshJwt: a.session.refreshJwt,
    });
  } catch {
    // Refresh failed — user will need to re-login
    await logout();
  }
}

/**
 * Check if the user is logged in to Bluesky.
 */
export async function isLoggedIn() {
  const saved = await storageGet(STORAGE_KEYS.BLUESKY_SESSION);
  return saved !== null;
}

/**
 * Fetch the Bluesky timeline and return normalised FeedItem[].
 * Returns an empty array if not logged in.
 */
export async function fetchTimeline(cursor) {
  try {
    const a = await getAgent();
    if (!a.session) return { items: [], cursor: undefined };

    const res = await a.getTimeline({ cursor, limit: 50 });

    const items = res.data.feed
      .map(normalizeBskyPost)
      .filter(Boolean);

    return { items, cursor: res.data.cursor };
  } catch (err) {
    // On 401, try refresh once
    if (err.status === 401) {
      await refreshSession();
      const a = await getAgent();
      if (!a.session) return { items: [], cursor: undefined };

      const res = await a.getTimeline({ cursor, limit: 50 });
      const items = res.data.feed.map(normalizeBskyPost).filter(Boolean);
      return { items, cursor: res.data.cursor };
    }

    // On 429 (rate limit), back off — caller should retry later
    if (err.status === 429) {
      console.warn('[FeedMe] Bluesky rate limited, backing off');
    }

    return { items: [], cursor: undefined };
  }
}
