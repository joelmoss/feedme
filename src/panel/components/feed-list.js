/**
 * <feed-list> — scrollable unified feed with read-position tracking
 * and infinite scroll via IntersectionObserver.
 */

import { MSG } from '../../shared/constants.js';

const template = document.createElement('template');
template.innerHTML = `
  <style>
    :host {
      display: block;
      overflow-y: auto;
      height: 100%;
    }

    .empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      padding: 32px;
      text-align: center;
      color: var(--text-secondary, #888);
    }

    .empty h2 {
      font-size: 16px;
      margin-bottom: 8px;
      color: var(--text, #e8e8e8);
    }

    .empty p {
      font-size: 13px;
      line-height: 1.6;
    }

    #sentinel {
      height: 1px;
    }
  </style>

  <div id="container"></div>
  <div id="sentinel"></div>
`;

class FeedList extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    this._container = this.shadowRoot.getElementById('container');
    this._sentinel = this.shadowRoot.getElementById('sentinel');
    this._readPosition = null;
    this._debounceTimer = null;
  }

  connectedCallback() {
    this.refresh();
    this._setupReadPositionTracking();
  }

  /**
   * Fetch feed data from the service worker and render.
   */
  async refresh() {
    const [feedRes, posRes] = await Promise.all([
      chrome.runtime.sendMessage({ type: MSG.GET_FEED }),
      chrome.runtime.sendMessage({ type: MSG.GET_READ_POSITION }),
    ]);

    const items = feedRes?.items ?? [];
    this._readPosition = posRes?.position ?? null;
    this._render(items);
  }

  _render(items) {
    this._container.innerHTML = '';

    if (items.length === 0) {
      this._container.innerHTML = `
        <div class="empty">
          <h2>No posts yet</h2>
          <p>Open <strong>x.com</strong> in a tab to capture your X feed, or log in to <strong>Bluesky</strong> in Settings.</p>
        </div>
      `;
      return;
    }

    let markerInserted = false;

    for (const item of items) {
      // Insert read marker before the last-read post
      if (!markerInserted && this._readPosition && item.id === this._readPosition) {
        const marker = document.createElement('read-marker');
        marker.id = 'read-marker';
        this._container.appendChild(marker);
        markerInserted = true;
      }

      const el = document.createElement('feed-item');
      el.setData(item);
      el.dataset.itemId = item.id;
      this._container.appendChild(el);
    }

    // Scroll to read marker if present
    if (markerInserted) {
      requestAnimationFrame(() => {
        const marker = this._container.querySelector('#read-marker');
        if (marker) {
          marker.scrollIntoView({ behavior: 'instant', block: 'start' });
        }
      });
    }
  }

  /**
   * Track which post is at the top of the viewport and save it
   * as the read position (debounced).
   */
  _setupReadPositionTracking() {
    const host = this.shadowRoot.host;

    host.addEventListener('scroll', () => {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = setTimeout(() => {
        this._saveTopVisibleItem();
      }, 500);
    }, { passive: true });
  }

  _saveTopVisibleItem() {
    const feedItems = this._container.querySelectorAll('feed-item');
    const hostRect = this.shadowRoot.host.getBoundingClientRect();

    for (const el of feedItems) {
      const rect = el.getBoundingClientRect();
      // Find the first item whose bottom is below the top of the scroll area
      if (rect.bottom > hostRect.top) {
        const itemId = el.dataset.itemId;
        if (itemId && itemId !== this._readPosition) {
          this._readPosition = itemId;
          chrome.runtime.sendMessage({
            type: MSG.SET_READ_POSITION,
            id: itemId,
          });
        }
        break;
      }
    }
  }
}

customElements.define('feed-list', FeedList);
