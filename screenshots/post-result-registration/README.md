# Play first, submit afterwards — browser pass

Captured from the production build (`npm run build` → `vite preview`) with Chromium at four
viewports, in a fresh context each time. **The game is played through at every viewport** —
all three levels, clicking what a person clicks — because the results screen cannot be reached
any other way, and reaching it any other way would not be evidence of anything.

The API is stubbed at the network layer, so this exercises the real bundle without a database.
The database side is verified separately, against real Postgres 16.

Nothing here is live data. The wallet address and post id are invented for the pass.

| | |
| --- | --- |
| `…-1-homepage.jpg` | the homepage: no form, no inputs, START GAME and VIEW LEADERBOARD |
| `…-2-anonymous-start.jpg` | Level 1, reached having submitted nothing |
| `…-3-result-with-form.jpg` | the full result, then the separator, then the form |
| `…-4-validation.jpg` | all four fields reported at once |
| `…-5-score-added.jpg` | SCORE ADDED, with the result card still on screen |
| `…-6-leaderboard.jpg` | the public board, wallets masked |
| `…-7-returning-homepage.jpg` | *Playing as Ada Lovelace*, with CHANGE PLAYER |

## What was asserted at every viewport

- The homepage carries **no registration form and no visible text input at all**.
- START GAME opens a game with no credentials sent — an anonymous session.
- All three levels are completed, and the completion is submitted.
- The **result card is on screen, the form is below it**, and nothing is laid over it.
- The download and share controls come **before** the form, because the form asks for a link to
  a post made from that card.
- The "Save your score below" hint is present.
- All four fields are required; an empty submit flags all four and sends nothing.
- A profile link in the X field is refused in the browser, with no request made.
- A valid submission carries the claim token and **no score**, and produces SCORE ADDED with the
  masked wallet — with the result card still there.
- The complete wallet appears nowhere in the document, on the result or on the leaderboard.
- A returning player is named on one line, is not shown the form, and is offered CHANGE PLAYER.
- `scrollWidth` never exceeds `clientWidth` — no horizontal overflow, on either screen.
