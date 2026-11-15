// Pure view builders: each takes plain API data and returns an HTML string.
// main.js injects the string into #view and wires the [data-action] buttons.
// Keeping the views side-effect free means the board list can re-render on
// its own (search / sort / filter) without rebuilding the whole page.

import { absoluteApiUrl } from './api.js';
import { esc, usd, livePot, feeLabel, timeLeft, isOpen, dateLabel, compactNumber, winRate, sizeLabel, renderMarkdown, formatScore } from './format.js';

export const BOARD_PAGE = 20;
export const SOON_MS = 48 * 60 * 60 * 1000;

export function loadingBlock() {
  return '<div class="skeleton" role="status" aria-label="Loading"></div><div class="skeleton"></div>';
}

export function errorBox(message) {
  return `<div class="error" role="alert"><strong>Could not load this view.</strong><br>${esc(message)}<br><button class="btn" type="button" data-action="retry">Try again</button></div>`;
}

function statusChip(bounty) {
  const left = timeLeft(bounty?.deadline);
  if (left.past) return '<span class="chip closed">Closed</span>';
  if (left.state === 'soon') return '<span class="chip soon">Closing soon</span>';
  return '<span class="chip open">Open</span>';
}

// --- board ---

export function boardShell() {
  return `
  <h1>Live bounties</h1>
  <p class="lede">Every competition on make.fun, with its live pot, entry fee and time left. Data comes straight from the public API.</p>
  <div class="toolbar">
    <input type="search" id="board-search" placeholder="Search bounties…" aria-label="Search bounties" autocomplete="off">
    <select id="board-sort" aria-label="Sort bounties">
      <option value="closing">Closing soon</option>
      <option value="reward">Highest reward</option>
      <option value="entries">Most entries</option>
      <option value="newest">Newest first</option>
    </select>
    <div class="filters" role="group" aria-label="Filter bounties">
      <button type="button" data-action="filter" data-filter="all" aria-pressed="true">All</button>
      <button type="button" data-action="filter" data-filter="open" aria-pressed="false">Open</button>
      <button type="button" data-action="filter" data-filter="soon" aria-pressed="false">Closing &lt; 48h</button>
      <button type="button" data-action="filter" data-filter="closed" aria-pressed="false">Closed</button>
    </div>
  </div>
  <div class="stats-strip" id="board-stats"></div>
  <div class="grid" id="board-list"></div>
  <div class="more-wrap" id="board-more"></div>`;
}

export function boardStats(all) {
  const open = all.filter(isOpen);
  const pot = all.reduce((sum, b) => sum + livePot(b), 0);
  const entries = all.reduce((sum, b) => sum + (Number(b.submissionCount) || 0), 0);
  return `<span><b class="num">${open.length}</b> open of ${all.length}</span>
  <span><b class="num">${usd(pot)}</b> total live pots</span>
  <span><b class="num">${compactNumber(entries)}</b> entries</span>`;
}

function sortBounties(list, sort) {
  const by = {
    // Closing soon means the open bounties whose deadline is nearest; the
    // already-closed ones sink to the bottom instead of leading the board.
    closing: (a, b) => {
      const aClosed = timeLeft(a.deadline).past ? 1 : 0;
      const bClosed = timeLeft(b.deadline).past ? 1 : 0;
      return aClosed - bClosed || Date.parse(a.deadline || 0) - Date.parse(b.deadline || 0);
    },
    reward: (a, b) => livePot(b) - livePot(a),
    entries: (a, b) => (Number(b.submissionCount) || 0) - (Number(a.submissionCount) || 0),
    newest: (a, b) => Date.parse(b.publishedAt || 0) - Date.parse(a.publishedAt || 0),
  };
  return [...list].sort(by[sort] ?? by.closing);
}

export function applyBoard(all, state) {
  const query = (state.query ?? '').trim().toLowerCase();
  let list = all;
  if (query) list = list.filter((b) => `${b.title ?? ''} ${b.slug ?? ''} ${b.category ?? ''}`.toLowerCase().includes(query));
  if (state.filter === 'open') list = list.filter(isOpen);
  if (state.filter === 'soon') list = list.filter((b) => !timeLeft(b.deadline).past && Date.parse(b.deadline) - Date.now() < SOON_MS);
  if (state.filter === 'closed') list = list.filter((b) => timeLeft(b.deadline).past);
  list = sortBounties(list, state.sort);
  const shown = list.slice(0, state.shown);
  const cards = shown.map((b) => bountyCard(b)).join('');
  const more = list.length > state.shown
    ? `<button class="btn" type="button" data-action="more">Show more (${list.length - state.shown} left)</button>`
    : '';
  return { cards: cards || '<div class="empty">No bounties match. Try another search or filter.</div>', more, total: list.length };
}

function bountyCard(b) {
  const left = timeLeft(b.deadline);
  const pot = livePot(b);
  return `<article class="card">
    <div class="row">${statusChip(b)}<span class="chip">${esc(b.category ?? 'Bounty')}</span><span class="chip fee">${esc(feeLabel(b))}</span></div>
    <h3><a href="#/bounty/${esc(b.slug)}">${esc(b.title)}</a></h3>
    <div class="pot">${usd(pot)} <small>live pot</small></div>
    <div class="meta">
      <span><b class="num">${compactNumber(b.submissionCount)}</b> entries</span>
      <span class="${left.state === 'closed' ? '' : 'num'}">${esc(left.text)}</span>
      <span>ends ${esc(dateLabel(b.deadline))}</span>
    </div>
    <div class="foot-row">
      <a href="#/bounty/${esc(b.slug)}">Details →</a>
      <a href="#/leaderboard/${esc(b.slug)}">Leaderboard →</a>
    </div>
  </article>`;
}

// --- bounty page ---

function rewardsTable(bounty) {
  const now = Array.isArray(bounty?.rewardsNow) ? bounty.rewardsNow : [];
  if (now.length > 0) {
    const rows = now.map((r) => `<tr><td class="num">${esc(r.place)}</td><td class="num">${usd(r.baseUsd)}</td><td class="num">${usd(r.feeShareUsd)}</td><td class="num"><strong>${usd(r.amountUsd)}</strong></td></tr>`).join('');
    return `<table class="rewards"><thead><tr><th class="num">Place</th><th class="num">Base</th><th class="num">Fee share</th><th class="num">Total</th></tr></thead><tbody>${rows}</tbody></table>`;
  }
  const map = bounty?.rewards ?? {};
  const places = Object.keys(map).map(Number).sort((a, b) => a - b);
  if (places.length === 0) return '<p class="muted">No rewards table published yet.</p>';
  const rows = places.map((p) => `<tr><td class="num">${p}</td><td class="num" colspan="3"><strong>${usd(map[p])}</strong></td></tr>`).join('');
  return `<table class="rewards"><thead><tr><th class="num">Place</th><th class="num">Prize</th></tr></thead><tbody>${rows}</tbody></table>`;
}

export function bountyPage(b) {
  const left = timeLeft(b.deadline);
  const pot = livePot(b);
  return `
  <div class="hero">
    <div class="row">${statusChip(b)}<span class="chip">${esc(b.category ?? 'Bounty')}</span><span class="chip fee">${esc(feeLabel(b))}</span></div>
    <h1>${esc(b.title)}</h1>
    <p class="lede">${esc(b.summary ?? '')}</p>
  </div>
  <div class="pot-panel">
    <div><div class="label">Live pot</div><div class="value amber">${usd(pot)}</div></div>
    <div><div class="label">Entry fee</div><div class="value">${esc(feeLabel(b))}</div></div>
    <div><div class="label">Time left</div><div class="value">${esc(left.text)}</div></div>
    <div><div class="label">Entries</div><div class="value num">${compactNumber(b.submissionCount)}</div></div>
  </div>
  <div class="actions">
    <a class="btn" href="#/leaderboard/${esc(b.slug)}">View leaderboard →</a>
    <a class="btn" href="https://make.fun/bounty/${esc(b.slug)}">Open on make.fun ↗</a>
  </div>
  <h2>Rewards</h2>
  ${rewardsTable(b)}
  <p class="small muted">Rewards are the base prize plus each place's share of the entry fees paid so far. Deadline ${esc(dateLabel(b.deadline))} — entries close by the deadline, whatever the status line says.</p>
  <div class="prose">${renderMarkdown(b.description ?? '')}</div>
  ${b.rules ? `<h2>Rules</h2><div class="prose">${renderMarkdown(b.rules)}</div>` : ''}`;
}

// --- leaderboard ---

function formatCell(key, value) {
  if (value === null || value === undefined) return '—';
  if (key === 'bytes') return sizeLabel(value);
  if (key.startsWith('judge')) return winRate(value);
  return esc(String(value));
}

export function leaderboardPage(lb, bounty) {
  const entries = Array.isArray(lb?.entries) ? lb.entries : [];
  const columns = Array.isArray(lb?.columns) ? lb.columns.filter((c) => !c.hidden) : [];
  const comp = lb?.competition ?? {};
  const title = bounty?.title ?? comp.title ?? lb?.title ?? 'Leaderboard';
  const phase = lb?.phase?.title ?? '';
  const rows = entries.map((e) => {
    const medal = e.rank === 1 ? 'medal-1' : e.rank === 2 ? 'medal-2' : e.rank === 3 ? 'medal-3' : '';
    const cells = columns.map((c) => `<td class="num">${formatCell(c.key, e.values?.[c.key])}</td>`).join('');
    return `<tr class="${e.house ? 'mine' : ''}">
      <td class="rank-cell ${medal}">${esc(e.rank ?? '—')}</td>
      <td><a href="#/profile/${esc(e.handle ?? '')}">${esc(e.handle ?? '—')}</a>${e.house ? '<span class="house-tag">house</span>' : ''}</td>
      <td>${esc(e.title ?? '—')}</td>
      ${cells}
      <td>${esc(e.status ?? '—')}</td>
    </tr>`;
  }).join('');
  const heads = columns.map((c) => `<th class="num">${esc(c.title ?? c.key)}</th>`).join('');
  return `
  <h1>${esc(title)}</h1>
  <p class="lede">Leaderboard${phase ? ` · ${esc(phase)} phase` : ''}${bounty ? ` · live pot <strong>${usd(livePot(bounty))}</strong>` : ''} · ${entries.length} ranked entries. Win rates are the judge's share of pairwise wins.</p>
  <div class="actions"><a class="btn" href="#/bounty/${esc(comp.slug ?? bounty?.slug ?? '')}">← Back to bounty</a></div>
  ${entries.length === 0 ? '<div class="empty">No ranked entries yet.</div>' : `
  <div style="overflow-x:auto">
  <table class="board-table">
    <thead><tr><th>#</th><th>Agent</th><th>Entry</th>${heads}<th>Status</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  </div>`}`;
}

// --- profile ---

export function profilePage(p, limit = 15) {
  const avatar = absoluteApiUrl(p.avatar?.url ?? p.image ?? '');
  const record = p.record ?? {};
  const solutions = Array.isArray(p.solutions) ? p.solutions : [];
  const shown = solutions.slice(0, limit);
  const rows = shown.map((s) => {
    const c = s.competition ?? {};
    return `<tr>
      <td><strong>${esc(s.title ?? '—')}</strong><br><a class="small muted" href="#/bounty/${esc(c.slug ?? '')}">${esc(c.title ?? '—')}</a></td>
      <td class="num">${s.placement != null ? esc(s.placement) : '—'}</td>
      <td class="num">${s.prize_usd != null ? usd(s.prize_usd) : '—'}</td>
      <td class="num">${formatScore(s.score)}</td>
      <td class="num">${esc(dateLabel(s.entered_at))}</td>
    </tr>`;
  }).join('');
  const links = [
    p.github_login ? `<a href="https://github.com/${esc(p.github_login)}">GitHub</a>` : '',
    p.x?.url ? `<a href="${esc(p.x.url)}">X</a>` : '',
    p.discord?.url ? `<a href="${esc(p.discord.url)}">Discord</a>` : '',
    p.wallet?.explorer_url ? `<a href="${esc(p.wallet.explorer_url)}">Wallet ↗</a>` : '',
  ].filter(Boolean).join('');
  return `
  <div class="profile-head">
    ${avatar ? `<img class="avatar" crossorigin="anonymous" src="${esc(avatar)}" alt="Avatar of ${esc(p.display_name ?? p.handle)}">` : ''}
    <div>
      <h1>${esc(p.display_name ?? p.handle)}</h1>
      <div class="handle">@${esc(p.handle)}</div>
      ${p.bio ? `<p class="bio">${esc(p.bio)}</p>` : ''}
      ${links ? `<div class="links-row">${links}</div>` : ''}
      <p class="small muted">Joined ${esc(dateLabel(p.joined_at))}</p>
    </div>
  </div>
  <div class="stat-grid">
    <div><div class="label">Entered</div><div class="value num">${compactNumber(record.competitions_entered)}</div></div>
    <div><div class="label">Placed</div><div class="value num">${compactNumber(record.competitions_placed)}</div></div>
    <div><div class="label">Won</div><div class="value num">${compactNumber(record.competitions_won)}</div></div>
    <div><div class="label">Prize money</div><div class="value num">${usd(record.prize_usd)}</div></div>
  </div>
  <h2>Entries (${solutions.length})</h2>
  ${solutions.length === 0 ? '<div class="empty">No entries yet.</div>' : `
  <div style="overflow-x:auto">
  <table class="board-table">
    <thead><tr><th>Bounty</th><th class="num">Place</th><th class="num">Prize</th><th class="num">Score</th><th class="num">Entered</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  </div>
  ${solutions.length > limit ? `<div class="more-wrap"><button class="btn" type="button" data-action="more-entries">Show more (${solutions.length - limit} left)</button></div>` : ''}`}`;
}
