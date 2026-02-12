/**
 * Background service worker.
 * Handles storage operations and side panel setup.
 */

import { MSG, SITES, storageKeyPosition, storageKeyHistory, MAX_HISTORY } from '../shared/constants.js';
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
      const site = position.site;
      if (!site) return { error: 'Missing site' };

      // Save as current position for this site
      await storageSet(storageKeyPosition(site), position);

      // Add to history (newest first, capped)
      const history = (await storageGet(storageKeyHistory(site))) ?? [];

      // Don't add duplicate if same post
      if (history.length === 0 || history[0].postId !== position.postId) {
        history.unshift(position);
        if (history.length > MAX_HISTORY) {
          history.length = MAX_HISTORY;
        }
        await storageSet(storageKeyHistory(site), history);
      }

      // Notify panel of update
      chrome.runtime.sendMessage({ type: MSG.POSITION_UPDATED }).catch(() => {});

      return { ok: true };
    }

    case MSG.GET_POSITION: {
      const site = message.site;
      if (site) {
        const position = await storageGet(storageKeyPosition(site));
        return { position };
      }

      // If no site specified, return all positions (for the panel)
      const positions = {};
      for (const s of SITES) {
        const pos = await storageGet(storageKeyPosition(s));
        if (pos) positions[s] = pos;
      }
      return { positions };
    }

    case MSG.GET_HISTORY: {
      const site = message.site;
      if (site) {
        const history = (await storageGet(storageKeyHistory(site))) ?? [];
        return { history };
      }

      // Return combined history from all sites, sorted by savedAt
      let combined = [];
      for (const s of SITES) {
        const history = (await storageGet(storageKeyHistory(s))) ?? [];
        combined = combined.concat(history);
      }
      combined.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
      return { history: combined };
    }

    case MSG.CLEAR_HISTORY: {
      const site = message.site;
      if (site) {
        await storageRemove(storageKeyHistory(site));
        await storageRemove(storageKeyPosition(site));
      } else {
        // Clear all sites
        for (const s of SITES) {
          await storageRemove(storageKeyHistory(s));
          await storageRemove(storageKeyPosition(s));
        }
      }
      return { ok: true };
    }

    case MSG.JUMP_TO_POSITION: {
      const site = message.site;
      const urlPatterns = [];

      if (site === 'x' || !site) {
        urlPatterns.push('https://x.com/*');
      }
      if (site === 'bsky' || !site) {
        urlPatterns.push('https://bsky.app/*');
      }

      const tabs = await chrome.tabs.query({ url: urlPatterns, active: true });
      if (tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: MSG.JUMP_TO_POSITION,
          postId: message.postId,
        }).catch(() => {});
      }
      return { ok: true };
    }

    default:
      return { error: 'Unknown message type' };
  }
}
