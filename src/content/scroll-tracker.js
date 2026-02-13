/**
 * Content script entry point.
 *
 * Tracks scroll idle on social feeds (x.com, bsky.app). When the user stops
 * scrolling for 30 seconds, places a visual marker below the topmost visible
 * post and saves the position. On page load, restores the marker from the
 * last saved position.
 */

import { IDLE_TIMEOUT_MS, MARKER_ID, MSG } from '../shared/constants.js';
import { getSiteAdapter } from './sites/adapter.js';
import { insertMarkerBefore, removeMarker, updateNewPostsLink } from './marker.js';

const adapter = getSiteAdapter();
if (!adapter) {
  throw new Error('FeedMe: unsupported site');
}

let idleTimer = null;
let currentUrl = location.href;
let newPostsObserver = null;
let newPostsDebounce = null;
let lastNewPostsCount = 0;

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
  // Check if the user clicked X.com's native "Show N posts" button
  if (adapter.isShowNewPostsButton?.(e.target)) {
    scrollToMarkerAfterLoad();
    return;
  }

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

  insertMarkerBefore(postEl, position.savedAt);
  startNewPostsObserver();

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
      insertMarkerBefore(postEl, position.savedAt);
      postEl.scrollIntoView({ behavior: 'instant', block: 'start' });
      startNewPostsObserver();
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

// ── Scroll to marker after native "Show N posts" loads ──────────────────

/**
 * After the user clicks X.com's native "Show N posts" button, the page loads
 * new posts and scrolls to the top. Poll for the marker to be present in the
 * DOM (it may get re-rendered), then scroll it into view.
 */
function scrollToMarkerAfterLoad() {
  const deadline = Date.now() + 5_000;
  const interval = setInterval(() => {
    const marker = document.getElementById(MARKER_ID);
    if (marker) {
      clearInterval(interval);
      // Wait a tick for the DOM to settle after new posts are inserted
      requestAnimationFrame(() => {
        marker.scrollIntoView({ behavior: 'instant', block: 'start' });
      });
      return;
    }
    if (Date.now() > deadline) {
      clearInterval(interval);
    }
  }, 200);
}

// ── New posts detection ──────────────────────────────────────────────────

function startNewPostsObserver() {
  stopNewPostsObserver();
  lastNewPostsCount = 0;

  newPostsObserver = new MutationObserver(() => {
    clearTimeout(newPostsDebounce);
    newPostsDebounce = setTimeout(checkNewPosts, 500);
  });

  newPostsObserver.observe(document.body, { childList: true, subtree: true });
}

function checkNewPosts() {
  const marker = document.getElementById(MARKER_ID);
  if (!marker) {
    stopNewPostsObserver();
    return;
  }

  const count = adapter.getPostsAbove(marker).length;
  if (count !== lastNewPostsCount) {
    lastNewPostsCount = count;
    updateNewPostsLink(count, () => loadNewPosts());
  }
}

function stopNewPostsObserver() {
  if (newPostsObserver) {
    newPostsObserver.disconnect();
    newPostsObserver = null;
  }
  clearTimeout(newPostsDebounce);
  newPostsDebounce = null;
  lastNewPostsCount = 0;
}

/**
 * "Load" new posts above the marker by removing the marker, scrolling to the
 * top to trigger the feed to render all new content, then scrolling back to
 * maintain the user's reading position.
 */
function loadNewPosts() {
  const marker = document.getElementById(MARKER_ID);
  if (!marker) return;

  stopNewPostsObserver();

  // Find the post just below the marker (the one the marker was placed before)
  const anchorPost = marker.nextElementSibling;
  if (!anchorPost) {
    marker.remove();
    return;
  }

  // Remember where the anchor post sits in the viewport before removing the marker
  const anchorOffsetBefore = anchorPost.getBoundingClientRect().top;

  // Remove the marker
  marker.remove();

  // Restore scroll so the anchor post stays at the same viewport position
  const anchorOffsetAfter = anchorPost.getBoundingClientRect().top;
  window.scrollBy({ top: anchorOffsetAfter - anchorOffsetBefore, behavior: 'instant' });
}

// ── SPA navigation handling ────────────────────────────────────────────────

function observeUrlChanges() {
  const observer = new MutationObserver(() => {
    if (location.href !== currentUrl) {
      currentUrl = location.href;
      clearTimeout(idleTimer);
      stopNewPostsObserver();
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
