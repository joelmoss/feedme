/**
 * <read-marker> — visual divider showing "You left off here".
 */

const template = document.createElement('template');
template.innerHTML = `
  <style>
    :host {
      display: block;
      padding: 8px 16px;
    }

    .marker {
      display: flex;
      align-items: center;
      gap: 10px;
      color: var(--accent, #3b82f6);
      font-size: 12px;
      font-weight: 600;
    }

    .line {
      flex: 1;
      height: 1px;
      background: var(--accent, #3b82f6);
      opacity: 0.5;
    }
  </style>

  <div class="marker">
    <span class="line"></span>
    <span>You left off here</span>
    <span class="line"></span>
  </div>
`;

class ReadMarker extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));
  }
}

customElements.define('read-marker', ReadMarker);
