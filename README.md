# make.fun board — a fast frontend for make.fun

[![make.fun · makefun-frontend-01](https://make.fun/badge/makefun-frontend-01.svg)](https://make.fun/bounty/makefun-frontend-01?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)
[![rank](https://make.fun/badge/makefun-frontend-01/Ikball53/makefun-frontend-01/rank.svg)](https://make.fun/bounty/makefun-frontend-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)
[![reward](https://make.fun/badge/makefun-frontend-01/Ikball53/makefun-frontend-01/reward.svg)](https://make.fun/bounty/makefun-frontend-01?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)

An unofficial, static frontend for [make.fun](https://make.fun), built for the
[makefun-frontend-01](https://make.fun/bounty/makefun-frontend-01) bounty. Plain
HTML + vanilla ES modules + CSS — no framework, no build step, no external
code. It reads only make.fun's public API (`https://make.fun/api`, GET).

## Surfaces

- **Board** (`#/`): every live bounty with its live pot, entry fee, time left
  and entry count. Search by title, sort (closing soon / highest reward /
  most entries / newest), filter (all / open / closing within 48h / closed),
  paginated 20 at a time.
- **Bounty page** (`#/bounty/<slug>`): summary, live pot panel, rewards table
  with each place's share of the entry fees, dates, and the full description
  and rules. Open/closed is decided by the deadline, not the status string.
- **Leaderboard** (`#/leaderboard/<slug>`): ranked entries with judge win
  rate, interval, size and status; handles link to profiles.
- **Profile** (`#/profile/<handle>`): avatar, bio, links, record (entered /
  placed / won / prize money) and the account's entries, paginated.

## Speed notes

- First load is the shell plus six small modules (about 30 KB raw, ~9 KB
  gzipped). No framework, no webfonts.
- API answers are cached in memory and revalidated with ETags (the API's
  ETags are bound to the minute, so a re-request inside the minute answers
  304). In-flight requests are shared, so a route change never double-fetches.
- Board controls re-render only the bounty list, never the whole page.

## Run it

Any static server with `app/` at its root works, e.g. from this directory:

```sh
python3 -m http.server --directory app 8080
```

Then open http://localhost:8080. `window.__shotReady` flips to `true` once a
route's data has rendered.

## Hand in

`main.ts` (Node 22, standard library only) copies `app/` and `screenshots/`
to `/output` and writes `/output/dossier.json` with `buildDossier` from
`vendor/makefun-frontend.ts` (the kit's copy, unchanged):

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Screenshots in `screenshots/` are real renders of this app on live make.fun
data: `1-board.png` (board), `2-bounty.png` (this bounty's page),
`3-leaderboard.png` (a live leaderboard).
