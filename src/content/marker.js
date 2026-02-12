/**
 * Creates, injects, and removes the visual "You left off here" marker
 * in the x.com timeline DOM.
 */

import { MARKER_ID } from '../shared/constants.js';

/**
 * Create the marker DOM element.
 */
export function createMarker(savedAt) {
  const marker = document.createElement('div');
  marker.id = MARKER_ID;

  const timeLabel = savedAt ? ` \u2014 ${formatRelativeTime(new Date(savedAt))}` : '';

  marker.innerHTML = `
    <div style="
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 16px;
      margin: 4px 0;
      background: linear-gradient(90deg, #1d4ed8 0%, #2563eb 100%);
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
      font-weight: 600;
      color: #fff;
      box-shadow: 0 2px 8px rgba(37, 99, 235, 0.3);
    ">
      <span style="flex-shrink: 0;">\u{1F4CD}</span>
      <span>You left off here${timeLabel}</span>
      <span style="flex: 1; height: 1px; background: rgba(255,255,255,0.3);"></span>
    </div>
  `;

  return marker;
}

/**
 * Insert the marker after a tweet <article> element.
 */
export function insertMarkerAfter(tweetEl, savedAt) {
  removeMarker();
  const marker = createMarker(savedAt);
  tweetEl.parentNode.insertBefore(marker, tweetEl.nextSibling);
  return marker;
}

/**
 * Remove any existing marker from the page.
 */
export function removeMarker() {
  const existing = document.getElementById(MARKER_ID);
  if (existing) {
    existing.remove();
  }
}

function formatRelativeTime(date) {
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay}d ago`;

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
