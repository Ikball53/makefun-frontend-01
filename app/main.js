// Bootstrap: route the hash to a view, fetch what it needs, and keep the
// header working. Board controls re-render only the board list; everything
// else swaps the whole #view. Nothing here rebuilds the page chrome.

import { listBounties, getBounty, getLeaderboard, getProfile } from './api.js';
import { startRouter } from './router.js';
import { boardShell, boardStats, applyBoard, bountyPage, leaderboardPage, profilePage, loadingBlock, errorBox, BOARD_PAGE } from './views.js';

const view = document.querySelector('#view');
const footNote = document.querySelector('#foot-note');

const boardState = { query: '', filter: 'all', sort: 'closing', shown: BOARD_PAGE };
let boardData = null;
let profileLimit = 15;
let profileData = null;

function paint(html) {
  view.innerHTML = html;
}

function paintBoardList() {
  if (!boardData) return;
  const list = document.querySelector('#board-list');
  const more = document.querySelector('#board-more');
  const stats = document.querySelector('#board-stats');
  if (!list) return;
  const result = applyBoard(boardData, boardState);
  list.innerHTML = result.cards;
  if (more) more.innerHTML = result.more;
  if (stats) stats.innerHTML = boardStats(boardData);
}

function syncBoardControls() {
  const search = document.querySelector('#board-search');
  const sort = document.querySelector('#board-sort');
  if (search) {
    search.value = boardState.query;
    search.addEventListener('input', () => {
      boardState.query = search.value;
      boardState.shown = BOARD_PAGE;
      paintBoardList();
    });
  }
  if (sort) {
    sort.value = boardState.sort;
    sort.addEventListener('change', () => {
      boardState.sort = sort.value;
      boardState.shown = BOARD_PAGE;
      paintBoardList();
    });
  }
}

async function renderBoard() {
  paint(boardShell());
  try {
    boardData = await listBounties();
    boardState.shown = BOARD_PAGE;
    paintBoardList();
    syncBoardControls();
    footNote.textContent = `Updated ${new Date().toLocaleTimeString()} · ${boardData.length} bounties`;
  } catch (err) {
    paint(errorBox(err.message));
  }
}

async function renderBounty(slug) {
  paint(loadingBlock());
  try {
    const bounty = await getBounty(slug);
    paint(bountyPage(bounty));
  } catch (err) {
    paint(errorBox(err.message));
  }
}

async function renderLeaderboard(slug) {
  paint(loadingBlock());
  try {
    const [lb, bounty] = await Promise.all([
      getLeaderboard(slug),
      getBounty(slug).catch(() => null),
    ]);
    paint(leaderboardPage(lb, bounty));
  } catch (err) {
    paint(errorBox(err.message));
  }
}

async function renderProfile(handle) {
  paint(loadingBlock());
  profileLimit = 15;
  try {
    profileData = await getProfile(handle);
    paint(profilePage(profileData, profileLimit));
  } catch (err) {
    paint(errorBox(err.message));
  }
}

async function render(route) {
  const titles = {
    board: 'make.fun · live bounty board',
    bounty: `${route.arg} · make.fun board`,
    leaderboard: `${route.arg} leaderboard · make.fun board`,
    profile: `@${route.arg} · make.fun board`,
  };
  document.title = titles[route.view] ?? titles.board;
  document.querySelectorAll('.topnav a').forEach((a) => {
    a.removeAttribute('aria-current');
    if (route.view === 'board' && a.getAttribute('href') === '#/') a.setAttribute('aria-current', 'page');
  });
  if (route.view === 'bounty') return renderBounty(route.arg);
  if (route.view === 'leaderboard') return renderLeaderboard(route.arg);
  if (route.view === 'profile') return renderProfile(route.arg);
  return renderBoard();
}

// One delegated click handler for every [data-action] button in the app.
document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const action = button.dataset.action;
  if (action === 'filter') {
    boardState.filter = button.dataset.filter;
    boardState.shown = BOARD_PAGE;
    document.querySelectorAll('[data-action="filter"]').forEach((b) => {
      b.setAttribute('aria-pressed', String(b === button));
    });
    paintBoardList();
  }
  if (action === 'more') {
    boardState.shown += BOARD_PAGE;
    paintBoardList();
  }
  if (action === 'more-entries' && profileData) {
    profileLimit += 15;
    paint(profilePage(profileData, profileLimit));
  }
  if (action === 'retry') {
    location.reload();
  }
});

// Header profile jump: "@handle" or "handle" -> #/profile/<handle>.
document.querySelector('#jump')?.addEventListener('submit', (event) => {
  event.preventDefault();
  const input = document.querySelector('#jump-handle');
  const handle = (input?.value ?? '').trim().replace(/^@/, '');
  if (handle) location.hash = `#/profile/${encodeURIComponent(handle)}`;
});

startRouter(render);
