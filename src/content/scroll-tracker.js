/**
 * Content script entry point.
 *
 * Tracks scroll idle on social feeds (x.com, bsky.app). When the user stops
 * scrolling for 30 seconds, places a visual marker below the topmost visible
 * post and saves the position. On page load, restores the marker from the
 * last saved position.
 */

import { IDLE_TIMEOUT_MS, MSG } from '../shared/constants.js';
import { getSiteAdapter } from './sites/adapter.js';
import { insertMarkerAfter, removeMarker } from './marker.js';

const adapter = getSiteAdapter();
if (!adapter) {
  throw new Error('FeedMe: unsupported site');
}

let idleTimer = null;
let currentUrl = location.href;

// ── Scroll idle detection ──────────────────────────────────────────────────

function startTracking() {
  window.addEventListener('scroll', onScroll, { passive: true });
  document.addEventListener('click', onClick, { capture: true });
  observeUrlChanges();
  restorePosition();
}

function onScroll() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(onScrollIdle, IDLE_TIMEOUT_MS);
}

async function onScrollIdle() {
  const postEl = adapter.getTopVisiblePost();
  if (!postEl) return;
  savePosition(postEl);
}

function onClick(e) {
  const postEl = adapter.getPostElement(e.target);
  if (!postEl) return;
  savePosition(postEl);
}

function savePosition(postEl) {
  const info = adapter.getPostInfo(postEl);
  if (!info) return;

  const position = {
    ...info,
    site: adapter.site,
    savedAt: new Date().toISOString(),
  };

  insertMarkerAfter(postEl, position.savedAt);

  chrome.runtime.sendMessage({
    type: MSG.SAVE_POSITION,
    position,
  }).catch(() => {});
}

// ── Restore position on load ───────────────────────────────────────────────

async function restorePosition() {
  try {
    const res = await chrome.runtime.sendMessage({
      type: MSG.GET_POSITION,
      site: adapter.site,
    });
    const position = res?.position;
    if (!position?.postId) return;

    // Wait for the timeline to be populated, then try to find the post
    waitForPost(position.postId, (postEl) => {
      insertMarkerAfter(postEl, position.savedAt);
      postEl.scrollIntoView({ behavior: 'instant', block: 'start' });
    });
  } catch {
    // Extension context may be invalid, ignore
  }
}

/**
 * Poll for a post to appear in the DOM (feeds load content lazily).
 * Gives up after 10 seconds.
 */
function waitForPost(postId, callback) {
  const deadline = Date.now() + 10_000;
  const interval = setInterval(() => {
    const el = adapter.findPostById(postId);
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
  const observer = new MutationObserver(() => {
    if (location.href !== currentUrl) {
      currentUrl = location.href;
      clearTimeout(idleTimer);
      removeMarker();

      if (adapter.isTimelinePage()) {
        restorePosition();
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

// ── Init ───────────────────────────────────────────────────────────────────

if (adapter.isTimelinePage()) {
  startTracking();
}

// Also handle SPA navigations into timeline pages
new MutationObserver(() => {
  if (adapter.isTimelinePage() && !idleTimer) {
    startTracking();
  }
}).observe(document.body, { childList: true, subtree: true });
