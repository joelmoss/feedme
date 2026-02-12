/**
 * Content script entry point.
 *
 * Tracks scroll idle on x.com. When the user stops scrolling for 1 minute,
 * places a visual marker below the topmost visible tweet and saves the
 * position. On page load, restores the marker from the last saved position.
 */

import { IDLE_TIMEOUT_MS, MSG, MARKER_ID } from '../shared/constants.js';
import { getTopVisibleTweet, getTweetInfo, findTweetById } from './tweet-finder.js';
import { insertMarkerAfter, removeMarker } from './marker.js';

let idleTimer = null;
let currentUrl = location.href;

// ── Scroll idle detection ──────────────────────────────────────────────────

function startTracking() {
  window.addEventListener('scroll', onScroll, { passive: true });
  observeUrlChanges();
  restorePosition();
}

function onScroll() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(onScrollIdle, IDLE_TIMEOUT_MS);
}

async function onScrollIdle() {
  const tweetEl = getTopVisibleTweet();
  if (!tweetEl) return;

  const info = getTweetInfo(tweetEl);
  if (!info) return;

  const position = {
    ...info,
    savedAt: new Date().toISOString(),
  };

  insertMarkerAfter(tweetEl, position.savedAt);

  // Save via background worker
  chrome.runtime.sendMessage({
    type: MSG.SAVE_POSITION,
    position,
  }).catch(() => {});
}

// ── Restore position on load ───────────────────────────────────────────────

async function restorePosition() {
  try {
    const res = await chrome.runtime.sendMessage({ type: MSG.GET_POSITION });
    const position = res?.position;
    if (!position?.tweetId) return;

    // Wait for the timeline to be populated, then try to find the tweet
    waitForTweet(position.tweetId, (tweetEl) => {
      insertMarkerAfter(tweetEl, position.savedAt);
      tweetEl.scrollIntoView({ behavior: 'instant', block: 'start' });
    });
  } catch {
    // Extension context may be invalid, ignore
  }
}

/**
 * Poll for a tweet to appear in the DOM (x.com loads content lazily).
 * Gives up after 10 seconds.
 */
function waitForTweet(tweetId, callback) {
  const deadline = Date.now() + 10_000;
  const interval = setInterval(() => {
    const el = findTweetById(tweetId);
    if (el) {
      clearInterval(interval);
      callback(el);
      return;
    }
    if (Date.now() > deadline) {
      clearInterval(interval);
    }
  }, 500);
}

// ── SPA navigation handling ────────────────────────────────────────────────

function observeUrlChanges() {
  // x.com is an SPA — detect URL changes to re-init on navigation
  const observer = new MutationObserver(() => {
    if (location.href !== currentUrl) {
      currentUrl = location.href;
      clearTimeout(idleTimer);
      removeMarker();

      // Only restore on main timeline pages
      if (isTimelinePage()) {
        restorePosition();
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

function isTimelinePage() {
  const path = location.pathname;
  return path === '/' || path === '/home' || path === '/following';
}

// ── Re-inject marker if x.com's virtual DOM removes it ─────────────────────

function observeMarkerRemoval() {
  const observer = new MutationObserver(() => {
    // If we have a saved position but the marker was removed by DOM recycling,
    // this is handled on next scroll idle or page navigation.
    // We don't aggressively re-inject to avoid conflicts with x.com's rendering.
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

// ── Init ───────────────────────────────────────────────────────────────────

if (isTimelinePage()) {
  startTracking();
}

// Also handle SPA navigations into timeline pages
new MutationObserver(() => {
  if (isTimelinePage() && !idleTimer) {
    startTracking();
  }
}).observe(document.body, { childList: true, subtree: true });
