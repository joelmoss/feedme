/**
 * Background service worker.
 * Handles storage operations and side panel setup.
 */

import { MSG, STORAGE_KEYS, MAX_HISTORY } from '../shared/constants.js';
import { storageGet, storageSet, storageRemove } from '../shared/storage.js';

// ── Open side panel on action click ────────────────────────────────────────

chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});

// ── Message handler ────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message).then(sendResponse);
  return true;
});

async function handleMessage(message) {
  switch (message.type) {
    case MSG.SAVE_POSITION: {
      const position = message.position;

      // Save as current position
      await storageSet(STORAGE_KEYS.POSITION, position);

      // Add to history (newest first, capped)
      const history = (await storageGet(STORAGE_KEYS.HISTORY)) ?? [];

      // Don't add duplicate if same tweet
      if (history.length === 0 || history[0].tweetId !== position.tweetId) {
        history.unshift(position);
        if (history.length > MAX_HISTORY) {
          history.length = MAX_HISTORY;
        }
        await storageSet(STORAGE_KEYS.HISTORY, history);
      }

      // Notify panel of update
      chrome.runtime.sendMessage({ type: MSG.POSITION_UPDATED }).catch(() => {});

      return { ok: true };
    }

    case MSG.GET_POSITION: {
      const position = await storageGet(STORAGE_KEYS.POSITION);
      return { position };
    }

    case MSG.GET_HISTORY: {
      const history = (await storageGet(STORAGE_KEYS.HISTORY)) ?? [];
      return { history };
    }

    case MSG.CLEAR_HISTORY: {
      await storageRemove(STORAGE_KEYS.HISTORY);
      await storageRemove(STORAGE_KEYS.POSITION);
      return { ok: true };
    }

    case MSG.JUMP_TO_POSITION: {
      // Forward to the active x.com tab's content script
      const tabs = await chrome.tabs.query({ url: 'https://x.com/*', active: true });
      if (tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: MSG.JUMP_TO_POSITION,
          tweetId: message.tweetId,
        }).catch(() => {});
      }
      return { ok: true };
    }

    default:
      return { error: 'Unknown message type' };
  }
}
