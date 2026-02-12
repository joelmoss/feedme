/**
 * Side panel logic — renders current positions and history across sites.
 */

import { MSG } from '../shared/constants.js';

const currentList = document.getElementById('current-list');
const historyList = document.getElementById('history-list');
const clearBtn = document.getElementById('clear-btn');

const SITE_LABELS = {
  x: 'X.com',
  bsky: 'Bluesky',
};

let activeSite = null;

// ── Init ───────────────────────────────────────────────────────────────────

loadData();

// Listen for position updates from the background worker
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === MSG.POSITION_UPDATED) {
    loadData();
  }
});

clearBtn.addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: MSG.CLEAR_HISTORY, site: activeSite });
  loadData();
});

// ── Data loading ───────────────────────────────────────────────────────────

async function loadData() {
  const siteRes = await chrome.runtime.sendMessage({ type: MSG.GET_ACTIVE_SITE });
  activeSite = siteRes?.site ?? null;

  const [posRes, histRes] = await Promise.all([
    chrome.runtime.sendMessage({ type: MSG.GET_POSITION, site: activeSite }),
    chrome.runtime.sendMessage({ type: MSG.GET_HISTORY, site: activeSite }),
  ]);

  if (activeSite) {
    const pos = posRes?.position;
    renderCurrentPositions(pos ? { [activeSite]: pos } : {});
  } else {
    renderCurrentPositions(posRes?.positions ?? {});
  }
  renderHistory(histRes?.history ?? []);
}

// ── Render ──────────────────────────────────────────────────────────────────

function renderCurrentPositions(positions) {
  const entries = Object.entries(positions);

  if (entries.length === 0) {
    currentList.innerHTML = `
      <div class="card empty-state">
        <p>No position saved yet.</p>
        <p class="hint">Browse X.com or Bluesky and stop scrolling for 30 seconds to save your place.</p>
      </div>
    `;
    return;
  }

  currentList.innerHTML = entries.map(([site, pos]) => `
    <div class="card current-highlight">
      <div class="site-label">${escapeHtml(SITE_LABELS[site] ?? site)}</div>
      <div class="author">${escapeHtml(pos.displayName)}</div>
      <div class="handle">${escapeHtml(pos.author)}</div>
      <div class="preview">${escapeHtml(pos.textPreview)}</div>
      <div class="meta">
        <span>${formatTime(pos.savedAt)}</span>
        <button class="jump-btn" data-post-id="${escapeAttr(pos.postId)}" data-site="${escapeAttr(pos.site)}">Jump to</button>
      </div>
    </div>
  `).join('');

  currentList.querySelectorAll('.jump-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      jumpTo(e.target.dataset.postId, e.target.dataset.site);
    });
  });
}

function renderHistory(history) {
  if (history.length === 0) {
    historyList.innerHTML = '<p class="empty-state">No history yet.</p>';
    clearBtn.classList.add('hidden');
    return;
  }

  clearBtn.classList.remove('hidden');

  historyList.innerHTML = history.map((pos) => `
    <div class="card">
      <div class="site-label">${escapeHtml(SITE_LABELS[pos.site] ?? pos.site)}</div>
      <div class="author">${escapeHtml(pos.displayName)}</div>
      <div class="handle">${escapeHtml(pos.author)}</div>
      <div class="preview">${escapeHtml(pos.textPreview)}</div>
      <div class="meta">
        <span>${formatTime(pos.savedAt)}</span>
        <button class="jump-btn" data-post-id="${escapeAttr(pos.postId)}" data-site="${escapeAttr(pos.site)}">Jump to</button>
      </div>
    </div>
  `).join('');

  historyList.querySelectorAll('.jump-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      jumpTo(e.target.dataset.postId, e.target.dataset.site);
    });
  });
}

// ── Actions ────────────────────────────────────────────────────────────────

function jumpTo(postId, site) {
  chrome.runtime.sendMessage({
    type: MSG.JUMP_TO_POSITION,
    postId,
    site,
  });
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
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

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeAttr(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}
