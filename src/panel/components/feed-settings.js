/**
 * <feed-settings> — Bluesky auth, connection status, and preferences.
 */

import { MSG } from '../../shared/constants.js';

const template = document.createElement('template');
template.innerHTML = `
  <style>
    :host {
      display: block;
      padding: 20px 16px;
      overflow-y: auto;
      height: 100%;
    }

    h2 {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 16px;
    }

    .section {
      margin-bottom: 24px;
    }

    .section-title {
      font-size: 13px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-secondary, #888);
      margin-bottom: 10px;
    }

    .status {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      margin-bottom: 8px;
    }

    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .dot-green { background: var(--success, #22c55e); }
    .dot-gray { background: var(--text-secondary, #888); }

    label {
      display: block;
      font-size: 13px;
      color: var(--text-secondary, #888);
      margin-bottom: 4px;
    }

    input[type="text"],
    input[type="password"] {
      width: 100%;
      padding: 8px 10px;
      border: 1px solid var(--border, #2a2a2a);
      border-radius: 6px;
      background: var(--bg-card, #1a1a1a);
      color: var(--text, #e8e8e8);
      font-size: 14px;
      margin-bottom: 10px;
    }

    input:focus {
      outline: none;
      border-color: var(--accent, #3b82f6);
    }

    .btn {
      padding: 8px 16px;
      border: none;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
    }

    .btn-primary {
      background: var(--accent, #3b82f6);
      color: #fff;
    }

    .btn-primary:hover {
      opacity: 0.9;
    }

    .btn-danger {
      background: transparent;
      color: var(--danger, #ef4444);
      border: 1px solid var(--danger, #ef4444);
    }

    .btn-danger:hover {
      background: var(--danger, #ef4444);
      color: #fff;
    }

    .error {
      color: var(--danger, #ef4444);
      font-size: 13px;
      margin-top: 4px;
    }

    .btn-row {
      display: flex;
      gap: 8px;
      margin-top: 4px;
    }

    .info {
      font-size: 13px;
      color: var(--text-secondary, #888);
      line-height: 1.5;
    }
  </style>

  <h2>Settings</h2>

  <div class="section">
    <div class="section-title">X.com</div>
    <div class="status">
      <span class="dot dot-gray" id="x-dot"></span>
      <span id="x-status">Open x.com in a tab to capture feed data</span>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Bluesky</div>
    <div id="bsky-logged-out">
      <label for="bsky-handle">Handle</label>
      <input type="text" id="bsky-handle" placeholder="you.bsky.social" />
      <label for="bsky-password">App Password</label>
      <input type="password" id="bsky-password" placeholder="xxxx-xxxx-xxxx-xxxx" />
      <div class="btn-row">
        <button class="btn btn-primary" id="bsky-login">Log in</button>
      </div>
      <div class="error hidden" id="bsky-error"></div>
      <p class="info" style="margin-top: 10px;">
        Create an app password at
        <a href="https://bsky.app/settings/app-passwords" target="_blank">bsky.app/settings/app-passwords</a>
      </p>
    </div>

    <div id="bsky-logged-in" class="hidden">
      <div class="status">
        <span class="dot dot-green"></span>
        <span>Connected</span>
      </div>
      <div class="btn-row">
        <button class="btn btn-danger" id="bsky-logout">Log out</button>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Data</div>
    <div class="btn-row">
      <button class="btn btn-danger" id="clear-feed">Clear cached feed</button>
    </div>
  </div>
`;

class FeedSettings extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));
  }

  connectedCallback() {
    this._loadState();

    this.shadowRoot.getElementById('bsky-login').addEventListener('click', () => this._login());
    this.shadowRoot.getElementById('bsky-logout').addEventListener('click', () => this._logout());
    this.shadowRoot.getElementById('clear-feed').addEventListener('click', () => this._clearFeed());
  }

  async _loadState() {
    const res = await chrome.runtime.sendMessage({ type: MSG.GET_SETTINGS });
    this._setBskyState(res?.bskyLoggedIn ?? false);
  }

  _setBskyState(loggedIn) {
    const loggedOutEl = this.shadowRoot.getElementById('bsky-logged-out');
    const loggedInEl = this.shadowRoot.getElementById('bsky-logged-in');

    if (loggedIn) {
      loggedOutEl.classList.add('hidden');
      loggedInEl.classList.remove('hidden');
    } else {
      loggedInEl.classList.add('hidden');
      loggedOutEl.classList.remove('hidden');
    }
  }

  async _login() {
    const handle = this.shadowRoot.getElementById('bsky-handle').value.trim();
    const appPassword = this.shadowRoot.getElementById('bsky-password').value.trim();
    const errorEl = this.shadowRoot.getElementById('bsky-error');

    if (!handle || !appPassword) {
      errorEl.textContent = 'Handle and app password are required';
      errorEl.classList.remove('hidden');
      return;
    }

    errorEl.classList.add('hidden');

    const res = await chrome.runtime.sendMessage({
      type: MSG.LOGIN_BLUESKY,
      handle,
      appPassword,
    });

    if (res?.success) {
      this.shadowRoot.getElementById('bsky-password').value = '';
      this._setBskyState(true);
    } else {
      errorEl.textContent = res?.error ?? 'Login failed';
      errorEl.classList.remove('hidden');
    }
  }

  async _logout() {
    await chrome.runtime.sendMessage({ type: MSG.LOGOUT_BLUESKY });
    this._setBskyState(false);
  }

  async _clearFeed() {
    await chrome.runtime.sendMessage({ type: MSG.LOGOUT_BLUESKY });
    this._setBskyState(false);
  }
}

customElements.define('feed-settings', FeedSettings);
