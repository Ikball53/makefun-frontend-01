// Pure formatting helpers: money, clocks, numbers and a small safe markdown
// renderer for bounty descriptions. Nothing here touches the network or the DOM.

export function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function usd(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Format an entry score the way its column means it: judge columns arrive as
// micro win-rate (762863 = 76.29%), PnL columns as micro-USDC.
export function formatScore(score) {
  if (!score) return '—';
  const key = score.column?.key ?? '';
  const value = Number(score.value ?? score.display);
  if (!Number.isFinite(value)) return '—';
  if (key.startsWith('judge') || String(score.column?.source ?? '').includes('win_rate')) return winRate(value);
  if (key === 'net_pnl') return usd(value / 1_000_000);
  return esc(String(score.display ?? value));
}

// A bounty's live pot: the fee-grown pot when the API reports one, else the
// base reward. Returns a number (0 when neither is present).
export function livePot(bounty) {
  const pot = Number(bounty?.potUsd);
  if (Number.isFinite(pot) && pot > 0) return pot;
  const base = Number(bounty?.rewardAmount);
  return Number.isFinite(base) ? base : 0;
}

export function feeLabel(bounty) {
  const fee = Number(bounty?.entryFeeUsd);
  if (Number.isFinite(fee) && fee > 0) return `${usd(fee)} fee`;
  return 'Free entry';
}

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const MIN_MS = 60_000;

// Time left until a deadline. A bounty is open while its deadline is ahead —
// its status alone can still read "open" after results publish.
export function timeLeft(deadline) {
  const end = Date.parse(deadline);
  if (!Number.isFinite(end)) return { text: '—', state: 'unknown', past: true };
  const diff = end - Date.now();
  if (diff <= 0) return { text: 'Closed', state: 'closed', past: true };
  const days = Math.floor(diff / DAY_MS);
  const hours = Math.floor((diff % DAY_MS) / HOUR_MS);
  const mins = Math.floor((diff % HOUR_MS) / MIN_MS);
  if (days > 0) return { text: `${days}d ${hours}h left`, state: days < 2 ? 'soon' : 'open', past: false };
  if (hours > 0) return { text: `${hours}h ${mins}m left`, state: 'soon', past: false };
  return { text: `${mins}m left`, state: 'soon', past: false };
}

export function isOpen(bounty) {
  return !timeLeft(bounty?.deadline).past;
}

export function dateLabel(iso) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '—';
  return new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function compactNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US');
}

// Win rates arrive as micro units (895253 = 89.5253%).
export function winRate(micro) {
  const n = Number(micro);
  if (!Number.isFinite(n)) return '—';
  return `${(n / 10_000).toFixed(2)}%`;
}

export function sizeLabel(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n)) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1_048_576) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1_048_576).toFixed(2)} MB`;
}

// Render the safe subset of markdown bounty descriptions use: headings,
// bold/italic/code, links, lists, quotes and fenced code. Raw HTML in the
// source is escaped first, so nothing the API returns can inject markup.
export function renderMarkdown(source) {
  const lines = String(source ?? '').split('\n');
  let out = '';
  let inList = '';
  let inCode = false;

  const inline = (text) => {
    let t = esc(text);
    t = t.replace(/`([^`]+)`/g, (_m, code) => `<code>${code}</code>`);
    t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    t = t.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
    t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" rel="noopener">$1</a>');
    return t;
  };

  const closeList = () => {
    if (inList) {
      out += `</${inList}>`;
      inList = '';
    }
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    if (line.startsWith('```')) {
      closeList();
      inCode = !inCode;
      out += inCode ? '<pre><code>' : '</code></pre>';
      continue;
    }
    if (inCode) {
      out += `${esc(raw)}\n`;
      continue;
    }
    if (!line.trim()) {
      closeList();
      continue;
    }
    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      closeList();
      const level = heading[1].length + 1;
      out += `<h${level}>${inline(heading[2])}</h${level}>`;
      continue;
    }
    const bullet = line.match(/^[-*]\s+(.*)$/);
    const ordered = line.match(/^\d+[.)]\s+(.*)$/);
    if (bullet || ordered) {
      const tag = bullet ? 'ul' : 'ol';
      if (inList !== tag) {
        closeList();
        out += `<${tag}>`;
        inList = tag;
      }
      out += `<li>${inline((bullet ?? ordered)[1])}</li>`;
      continue;
    }
    closeList();
    if (line.startsWith('&gt; ') || line.startsWith('> ')) {
      out += `<blockquote>${inline(line.slice(2))}</blockquote>`;
      continue;
    }
    out += `<p>${inline(line)}</p>`;
  }
  closeList();
  if (inCode) out += '</code></pre>';
  return out;
}
