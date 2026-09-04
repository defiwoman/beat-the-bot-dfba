# The registration form on the homepage — browser pass

Captured from the production build (`npm run build` → `vite preview`) with Chromium at four
viewports, in a **completely fresh browser context each time**: no localStorage, no
sessionStorage, no cookies. The API is stubbed at the network layer, so this exercises the real
bundle without a database.

Nothing here is live data. The wallet address and post id are invented for the pass.

## Per viewport

| | 360×800 | 390×844 | 768×1024 | 1440×900 |
| --- | --- | --- | --- | --- |
| Fresh homepage, form visible | `…-1-fresh.jpg` | | | |
| All four fields rejected | `…-2-validation.jpg` | | | |
| Level 1, after a complete registration | `…-3-registered.jpg` | | | |
| Returning player | `…-4-returning.jpg` | | | |
| Public leaderboard | `…-5-leaderboard.jpg` | | | |
| Change player, form back | `…-6-change-player.jpg` | | | |
| Database unavailable | `…-7-database-down.jpg` | | | |

Whole-page captures: `390x844-full-fresh.jpg`, `390x844-full-returning.jpg`,
`1440x900-full-fresh.jpg`.

## What was asserted at every viewport

- The form is visible with **no clicks at all**; there is no dialog and no START GAME button.
- All four fields are present and all four carry **REQUIRED**.
- The disclaimer reads "no wallet **connection**, no funds and no live trading".
- An empty submit flags all four fields and does not open Level 1.
- A profile link in the X field is refused in the browser, and does not open Level 1.
- A complete, valid registration opens Level 1 — and only then.
- Credentials are stored; the wallet address is not in them.
- A returning player sees the welcome-back panel with PLAY AGAIN, VIEW LEADERBOARD and
  CHANGE PLAYER, and no form.
- The public leaderboard shows `8HvP…9xQa`; the full address and the post link appear nowhere
  in the document.
- CHANGE PLAYER clears the credentials and brings the form back.
- With every API call failing, the form still renders, the error says nothing technical, every
  typed value survives, and Level 1 does not open.
- `scrollWidth` never exceeds `clientWidth` — no horizontal overflow.
