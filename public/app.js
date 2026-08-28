const statusEl = document.getElementById('status');
const configEl = document.getElementById('config');
const rollEl = document.getElementById('receipt-roll');
const clearBtn = document.getElementById('clear-btn');

let ws = null;

function setStatus(text, disconnected) {
  statusEl.textContent = text;
  statusEl.classList.toggle('disconnected', Boolean(disconnected));
}

function connect() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${location.host}`);

  ws.addEventListener('open', () => setStatus('connected'));
  ws.addEventListener('close', () => {
    setStatus('disconnected', true);
    setTimeout(connect, 1500);
  });
  ws.addEventListener('error', () => ws.close());

  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === 'snapshot') {
      render(msg.receipt);
    } else if (msg.type === 'error') {
      console.error('[posprint-emu]', msg.message);
    }
  });
}

function el(tag, className, children) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  for (const child of children ?? []) {
    if (child == null) continue;
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

function renderSpan(span) {
  const node = document.createElement('span');
  const classes = [];
  if (span.bold) classes.push('span-bold');
  if (span.underline) classes.push('span-underline');
  if (classes.length) node.className = classes.join(' ');

  const styles = [];
  if (span.heightMultiplier > 1) {
    styles.push(`font-size:${span.heightMultiplier}em`, `line-height:${span.heightMultiplier}em`);
  }
  if (span.widthMultiplier > 1) {
    styles.push(`display:inline-block`, `transform:scaleX(${span.widthMultiplier})`, `transform-origin:left`);
  }
  if (styles.length) node.setAttribute('style', styles.join(';'));

  node.textContent = span.text;
  return node;
}

function renderElement(element) {
  switch (element.type) {
    case 'line': {
      const line = el('div', `receipt-line align-${element.align}`, []);
      if (element.spans.length === 0) {
        line.innerHTML = '&nbsp;';
      } else {
        for (const span of element.spans) line.appendChild(renderSpan(span));
      }
      return line;
    }
    case 'image': {
      const img = document.createElement('img');
      img.className = `receipt-image align-${element.align}`;
      img.src = element.pngDataUrl;
      img.width = element.widthPx;
      img.height = element.heightPx;
      return img;
    }
    case 'spacer': {
      const spacer = document.createElement('div');
      spacer.style.height = `${element.heightPx}px`;
      return spacer;
    }
    case 'jobMarker': {
      const when = new Date(element.timestamp).toLocaleTimeString();
      return el('div', 'job-marker', [`→ connection from ${element.remoteAddress} at ${when}`]);
    }
    default:
      return document.createComment('unknown element');
  }
}

function renderSegment(segment) {
  const segmentEl = el('div', 'segment', []);
  if (segment.jobMeta) {
    const when = new Date(segment.jobMeta.startedAt).toLocaleTimeString();
    segmentEl.appendChild(el('div', 'job-marker', [`→ connection from ${segment.jobMeta.remoteAddress} at ${when}`]));
  }
  for (const element of segment.elements) {
    segmentEl.appendChild(renderElement(element));
  }
  return segmentEl;
}

function render(receipt) {
  document.documentElement.style.setProperty('--columns', String(receipt.columns));
  rollEl.replaceChildren();

  receipt.segments.forEach((segment, index) => {
    rollEl.appendChild(renderSegment(segment));
    if (segment.cut) {
      const label = segment.cut.mode === 'full' ? 'full cut' : 'partial cut';
      rollEl.appendChild(el('hr', 'tear-line', []));
      rollEl.appendChild(el('div', 'job-marker', [`✂ ${label}`]));
    } else if (index < receipt.segments.length - 1) {
      rollEl.appendChild(el('hr', 'tear-line', []));
    }
  });
}

clearBtn.addEventListener('click', () => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'clear' }));
  } else {
    fetch('/api/clear', { method: 'POST' }).catch(() => {});
  }
});

fetch('/api/config')
  .then((res) => res.json())
  .then((config) => {
    configEl.textContent = `TCP :${config.tcpPort} · UI :${config.httpPort} · ${config.columns} cols`;
  })
  .catch(() => {});

connect();
