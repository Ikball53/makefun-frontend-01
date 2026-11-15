// Hash routing: #/ , #/bounty/<slug>, #/leaderboard/<slug>, #/profile/<handle>.
// Every route is a plain link and its own address, so a bounty, a leaderboard
// or a profile can be shared and re-opened directly.
//
// window.__shotReady is the screenshot hook: false while a route is loading,
// true once its data has rendered (or its error state has).

export function parseRoute(hash = location.hash) {
  const raw = String(hash || '').replace(/^#/, '');
  const parts = raw.split('/').filter(Boolean);
  if (parts.length === 0) return { view: 'board', arg: '' };
  // Handles arrive with or without a leading @ ("#/profile/@eightball-fr").
  const arg = parts[1] ? decodeURIComponent(parts[1]).replace(/^@/, '') : '';
  if (parts[0] === 'bounty' && arg) return { view: 'bounty', arg };
  if (parts[0] === 'leaderboard' && arg) return { view: 'leaderboard', arg };
  if (parts[0] === 'profile' && arg) return { view: 'profile', arg };
  return { view: 'board', arg: '' };
}

export function go(route) {
  location.hash = route;
}

export function markLoading() {
  window.__shotReady = false;
}

export function markReady() {
  window.__shotReady = true;
}

// Run `render` for the current hash now and on every hash change. Rendering
// is serialized so a fast double-navigation never paints a stale route.
export function startRouter(render) {
  let ticket = 0;
  const run = async () => {
    const mine = ++ticket;
    markLoading();
    try {
      await render(parseRoute());
    } finally {
      if (mine === ticket) markReady();
    }
  };
  window.addEventListener('hashchange', run);
  return run();
}
