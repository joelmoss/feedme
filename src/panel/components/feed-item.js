/**
 * <feed-item> — renders a single post card in the unified feed.
 */

const template = document.createElement('template');
template.innerHTML = `
  <style>
    :host {
      display: block;
      padding: 12px 16px;
      border-bottom: 1px solid var(--border, #2a2a2a);
      transition: background 0.15s;
    }

    :host(:hover) {
      background: var(--bg-card-hover, #222);
    }

    .repost-label {
      font-size: 12px;
      color: var(--text-secondary, #888);
      margin-bottom: 4px;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 6px;
    }

    .avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      object-fit: cover;
      background: var(--border, #2a2a2a);
      flex-shrink: 0;
    }

    .author-info {
      flex: 1;
      min-width: 0;
    }

    .display-name {
      font-weight: 600;
      font-size: 14px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .handle {
      font-size: 12px;
      color: var(--text-secondary, #888);
    }

    .badge {
      font-size: 10px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 4px;
      flex-shrink: 0;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .badge-x {
      background: #333;
      color: var(--x-color, #e7e9ea);
    }

    .badge-bsky {
      background: #0085ff22;
      color: var(--bsky-color, #0085ff);
    }

    .body {
      font-size: 14px;
      line-height: 1.5;
      white-space: pre-wrap;
      word-break: break-word;
      margin-bottom: 8px;
    }

    .media-grid {
      display: grid;
      gap: 4px;
      margin-bottom: 8px;
      border-radius: var(--radius, 8px);
      overflow: hidden;
    }

    .media-grid[data-count="1"] { grid-template-columns: 1fr; }
    .media-grid[data-count="2"] { grid-template-columns: 1fr 1fr; }
    .media-grid[data-count="3"],
    .media-grid[data-count="4"] { grid-template-columns: 1fr 1fr; }

    .media-grid img,
    .media-grid video {
      width: 100%;
      max-height: 200px;
      object-fit: cover;
      display: block;
    }

    .footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .timestamp {
      font-size: 12px;
      color: var(--text-secondary, #888);
    }

    .permalink {
      font-size: 12px;
      color: var(--accent, #3b82f6);
      text-decoration: none;
    }

    .permalink:hover {
      text-decoration: underline;
    }
  </style>

  <div class="repost-label hidden" id="repost"></div>
  <div class="header">
    <img class="avatar" id="avatar" alt="" />
    <div class="author-info">
      <div class="display-name" id="displayName"></div>
      <div class="handle" id="handle"></div>
    </div>
    <span class="badge" id="badge"></span>
  </div>
  <div class="body" id="body"></div>
  <div class="media-grid hidden" id="media"></div>
  <div class="footer">
    <span class="timestamp" id="timestamp"></span>
    <a class="permalink" id="permalink" target="_blank" rel="noopener">View</a>
  </div>
`;

class FeedItem extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));
  }

  /**
   * Populate this element with a FeedItem data object.
   */
  setData(item) {
    this._itemId = item.id;

    // Repost label
    const repostEl = this.shadowRoot.getElementById('repost');
    if (item.repostBy) {
      repostEl.textContent = `\u{1F501} ${item.repostBy} reposted`;
      repostEl.classList.remove('hidden');
    } else {
      repostEl.classList.add('hidden');
    }

    // Avatar
    const avatarEl = this.shadowRoot.getElementById('avatar');
    avatarEl.src = item.author.avatarUrl || '';
    avatarEl.alt = item.author.displayName;

    // Author
    this.shadowRoot.getElementById('displayName').textContent = item.author.displayName;
    this.shadowRoot.getElementById('handle').textContent = `@${item.author.handle}`;

    // Badge
    const badgeEl = this.shadowRoot.getElementById('badge');
    badgeEl.textContent = item.platform === 'x' ? 'X' : 'BSKY';
    badgeEl.className = `badge badge-${item.platform}`;

    // Body text
    this.shadowRoot.getElementById('body').textContent = item.text;

    // Media
    const mediaEl = this.shadowRoot.getElementById('media');
    mediaEl.innerHTML = '';
    if (item.media && item.media.length > 0) {
      mediaEl.classList.remove('hidden');
      mediaEl.setAttribute('data-count', Math.min(item.media.length, 4));
      for (const m of item.media.slice(0, 4)) {
        if (m.type === 'image') {
          const img = document.createElement('img');
          img.src = m.url;
          img.alt = m.alt || '';
          img.loading = 'lazy';
          mediaEl.appendChild(img);
        } else if (m.type === 'video') {
          const video = document.createElement('video');
          video.src = m.url;
          video.controls = true;
          video.preload = 'none';
          mediaEl.appendChild(video);
        }
      }
    } else {
      mediaEl.classList.add('hidden');
    }

    // Timestamp
    const date = new Date(item.createdAt);
    this.shadowRoot.getElementById('timestamp').textContent = formatRelativeTime(date);

    // Permalink
    const link = this.shadowRoot.getElementById('permalink');
    link.href = item.url;
  }

  getItemId() {
    return this._itemId;
  }
}

function formatRelativeTime(date) {
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return `${diffSec}s`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay}d`;

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

customElements.define('feed-item', FeedItem);
