/**
 * Central message handler for the service worker.
 * Routes messages from content scripts and the side panel.
 */

import { MSG, STORAGE_KEYS } from '../shared/constants.js';
import { storageGet, storageSet } from '../shared/storage.js';
import { extractXTimelineEntries, normalizeXTweet } from '../lib/normalizer.js';
import { ingestItems, getItems, clearItems } from './feed-store.js';
import { login, logout, isLoggedIn } from './bluesky-client.js';

/**
 * Handle an incoming message. Returns the response value.
 */
export async function handleMessage(message) {
  switch (message.type) {
    case MSG.X_FEED_DATA:
      return handleXFeedData(message.payload);

    case MSG.GET_FEED:
      return { items: getItems() };

    case MSG.GET_READ_POSITION:
      return { position: await storageGet(STORAGE_KEYS.READ_POSITION) };

    case MSG.SET_READ_POSITION:
      await storageSet(STORAGE_KEYS.READ_POSITION, message.id);
      return { ok: true };

    case MSG.GET_SETTINGS:
      return {
        settings: (await storageGet(STORAGE_KEYS.SETTINGS)) ?? {},
        bskyLoggedIn: await isLoggedIn(),
      };

    case MSG.SAVE_SETTINGS:
      await storageSet(STORAGE_KEYS.SETTINGS, message.settings);
      return { ok: true };

    case MSG.LOGIN_BLUESKY:
      return login(message.handle, message.appPassword);

    case MSG.LOGOUT_BLUESKY:
      await logout();
      await clearItems(); // clear feed since bluesky items are no longer valid
      return { ok: true };

    default:
      return { error: 'Unknown message type' };
  }
}

/**
 * Process raw X.com timeline JSON: extract tweets, normalise, ingest.
 */
async function handleXFeedData(payload) {
  const rawTweets = extractXTimelineEntries(payload);
  const feedItems = rawTweets.map(normalizeXTweet).filter(Boolean);

  const added = await ingestItems(feedItems);
  if (added) {
    // Notify any open panels that new data is available
    notifyPanels();
  }
  return { ok: true, count: feedItems.length };
}

/**
 * Send FEED_UPDATED to any connected panels/tabs.
 */
function notifyPanels() {
  chrome.runtime.sendMessage({ type: MSG.FEED_UPDATED }).catch(() => {
    // No listeners — that's fine
  });
}
