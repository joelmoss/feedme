/**
 * <feed-panel> — root element with navigation between feed and settings.
 */
import { MSG } from '../../shared/constants.js';

const template = document.createElement('template');
template.innerHTML = `
  <style>
    :host {
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
    }

    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      border-bottom: 1px solid var(--border, #2a2a2a);
      background: var(--bg, #0f0f0f);
      flex-shrink: 0;
    }

    h1 {
      font-size: 18px;
      font-weight: 700;
      letter-spacing: -0.02em;
    }

    .nav-btn {
      background: none;
      border: 1px solid var(--border, #2a2a2a);
      color: var(--text, #e8e8e8);
      border-radius: 6px;
      padding: 6px 10px;
      font-size: 13px;
    }

    .nav-btn:hover {
      background: var(--bg-card, #1a1a1a);
    }

    .view-container {
      flex: 1;
      overflow: hidden;
      position: relative;
    }

    .view-container > * {
      position: absolute;
      inset: 0;
      overflow-y: auto;
    }

    .hidden {
      display: none !important;
    }
  </style>

  <header>
    <h1>FeedMe</h1>
    <button class="nav-btn" id="toggle-view">Settings</button>
  </header>
  <div class="view-container">
    <feed-list id="feed-view"></feed-list>
    <feed-settings id="settings-view" class="hidden"></feed-settings>
  </div>
`;

class FeedPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    this._feedView = this.shadowRoot.getElementById('feed-view');
    this._settingsView = this.shadowRoot.getElementById('settings-view');
    this._toggleBtn = this.shadowRoot.getElementById('toggle-view');
    this._showingSettings = false;
  }

  connectedCallback() {
    this._toggleBtn.addEventListener('click', () => this._toggle());

    // Listen for feed updates from the service worker
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.type === MSG.FEED_UPDATED) {
        this._feedView.refresh();
      }
    });
  }

  _toggle() {
    this._showingSettings = !this._showingSettings;

    if (this._showingSettings) {
      this._feedView.classList.add('hidden');
      this._settingsView.classList.remove('hidden');
      this._toggleBtn.textContent = 'Feed';
    } else {
      this._settingsView.classList.add('hidden');
      this._feedView.classList.remove('hidden');
      this._toggleBtn.textContent = 'Settings';
      this._feedView.refresh();
    }
  }
}

customElements.define('feed-panel', FeedPanel);
