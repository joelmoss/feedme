/**
 * Background service worker entry point.
 * Sets up message handling, alarms, and Bluesky polling.
 */

import { ALARMS, BSKY_POLL_INTERVAL_MIN, MSG } from '../shared/constants.js';
import { handleMessage } from './message-handler.js';
import { initStore, ingestItems } from './feed-store.js';
import { fetchTimeline, refreshSession } from './bluesky-client.js';

// ── Initialise on wake ─────────────────────────────────────────────────────

initStore();

// ── Message listener ───────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message).then(sendResponse);
  return true; // keep the channel open for async response
});

// ── Side panel open on action click ────────────────────────────────────────

chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});

// ── Alarms ─────────────────────────────────────────────────────────────────

// Start Bluesky polling alarm
chrome.alarms.create(ALARMS.BSKY_POLL, {
  periodInMinutes: BSKY_POLL_INTERVAL_MIN,
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARMS.BSKY_POLL) {
    await pollBluesky();
  } else if (alarm.name === ALARMS.BSKY_TOKEN_REFRESH) {
    await refreshSession();
  }
});

// ── Bluesky polling ────────────────────────────────────────────────────────

async function pollBluesky() {
  const { items } = await fetchTimeline();
  if (items.length > 0) {
    const added = await ingestItems(items);
    if (added) {
      chrome.runtime.sendMessage({ type: MSG.FEED_UPDATED }).catch(() => {});
    }
  }
}

// Run an initial poll on startup
pollBluesky();
