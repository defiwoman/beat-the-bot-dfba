# Registration and leaderboard screenshots

Captured with Playwright/Chromium against the production build, the real Netlify Functions
(`netlify functions:serve`) and a real Postgres 16 database with migration `0001` applied —
not against stubs. Four viewports were played end to end: **360×800**, **390×844**,
**768×1024** and **1440×900**; the phone and desktop passes are photographed.

| File | Shows |
| --- | --- |
| `*-1-opening.jpg` | Opening screen with the LEADERBOARD action, hierarchy unchanged |
| `*-2-registration.jpg` | PLAYER REGISTRATION — three fields, no wallet connection |
| `*-3-validation.jpg` | Inline errors, focus moved to the first invalid field |
| `*-4-result-saved.jpg` | FINAL SCORE / PERSONAL BEST / CURRENT RANK, NEW PERSONAL BEST |
| `*-5-leaderboard.jpg` | The public board: masked wallets, the YOU row, ranking note |
| `*-6-admin-login.jpg` | The private admin page before authorisation |
| `*-7-admin-table.jpg` | The private admin table with complete wallets and both CSV buttons |

## What the browser pass asserts

At every screen, at every viewport:

- **No complete wallet address** in the page HTML or in any element attribute.
- **No campaign language**: airdrop, air drop, prize, giveaway, token reward, claim your,
  eligib, 6,000, 60,000, fogo reward, winners receive.
- Every wallet cell matches exactly `····…····` — four characters, ellipsis, four characters.
- The current player's row is marked.
- FINAL SCORE, PERSONAL BEST and CURRENT RANK are all present after a finished game.
- A LEADERBOARD action exists on the opening screen.
- Registration shows accessible inline errors before contacting the server.
- No console errors, no page errors, no horizontal overflow.

Half-scale JPEGs so the record stays small. Nothing here ships with the app.
