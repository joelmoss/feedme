/**
 * Side panel logic — renders current position and history.
 */

import { MSG } from '../shared/constants.js';

const currentCard = document.getElementById('current-card');
const historyList = document.getElementById('history-list');
const clearBtn = document.getElementById('clear-btn');

// ── Init ───────────────────────────────────────────────────────────────────

loadData();

// Listen for position updates from the background worker
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === MSG.POSITION_UPDATED) {
    loadData();
  }
});

clearBtn.addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: MSG.CLEAR_HISTORY });
  loadData();
});

// ── Data loading ───────────────────────────────────────────────────────────

async function loadData() {
  const [posRes, histRes] = await Promise.all([
    chrome.runtime.sendMessage({ type: MSG.GET_POSITION }),
    chrome.runtime.sendMessage({ type: MSG.GET_HISTORY }),
  ]);

  renderCurrentPosition(posRes?.position);
  renderHistory(histRes?.history ?? []);
}

// ── Render ──────────────────────────────────────────────────────────────────

function renderCurrentPosition(position) {
  if (!position) {
    currentCard.className = 'card empty-state';
    currentCard.innerHTML = `
      <p>No position saved yet.</p>
      <p class="hint">Browse x.com and stop scrolling for 1 minute to save your place.</p>
    `;
    return;
  }

  currentCard.className = 'card current-highlight';
  currentCard.innerHTML = `
    <div class="author">${escapeHtml(position.displayName)}</div>
    <div class="handle">${escapeHtml(position.author)}</div>
    <div class="preview">${escapeHtml(position.textPreview)}</div>
    <div class="meta">
      <span>${formatTime(position.savedAt)}</span>
      <button class="jump-btn" data-tweet-id="${escapeAttr(position.tweetId)}">Jump to</button>
    </div>
  `;

  currentCard.querySelector('.jump-btn').addEventListener('click', (e) => {
    jumpTo(e.target.dataset.tweetId);
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
      <div class="author">${escapeHtml(pos.displayName)}</div>
      <div class="handle">${escapeHtml(pos.author)}</div>
      <div class="preview">${escapeHtml(pos.textPreview)}</div>
      <div class="meta">
        <span>${formatTime(pos.savedAt)}</span>
        <button class="jump-btn" data-tweet-id="${escapeAttr(pos.tweetId)}">Jump to</button>
      </div>
    </div>
  `).join('');

  historyList.querySelectorAll('.jump-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      jumpTo(e.target.dataset.tweetId);
    });
  });
}

// ── Actions ────────────────────────────────────────────────────────────────

function jumpTo(tweetId) {
  chrome.runtime.sendMessage({
    type: MSG.JUMP_TO_POSITION,
    tweetId,
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
