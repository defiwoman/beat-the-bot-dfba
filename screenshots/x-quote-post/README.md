# X quote-post field — browser pass

Captured from the production build (`npm run build` → `vite preview`) with Chromium at four
viewports, plus the private administration page rendered from a local Postgres 16 holding the
real schema.

Nothing here is live data. The wallet addresses and post ids are invented for the pass; the
post links address no real post.

## The registration panel

| | 360×800 | 390×844 | 768×1024 | 1440×900 |
| --- | --- | --- | --- | --- |
| Empty form | `360x800-form.jpg` | `390x844-form.jpg` | `768x1024-form.jpg` | `1440x900-form.jpg` |
| All four fields rejected | `-errors.jpg` | `-errors.jpg` | `-errors.jpg` | `-errors.jpg` |
| A profile link, not a post | `-bad-link.jpg` | `-bad-link.jpg` | `-bad-link.jpg` | `-bad-link.jpg` |
| The server's duplicate answer | `-duplicate.jpg` | `-duplicate.jpg` | `-duplicate.jpg` | `-duplicate.jpg` |

At every viewport:

- all four fields carry the **REQUIRED** badge;
- an empty submit reports all four at once and moves focus to **PLAYER NAME**;
- a profile link is refused in the browser, without a request, and focus moves to the X field;
- the server's duplicate answer lands on the X field, focus follows it, and the game does not
  start;
- `document.documentElement.scrollWidth` never exceeds `clientWidth` — no horizontal overflow.

## The private administration page

| | |
| --- | --- |
| `admin-login.jpg` | the token form, served with 401 |
| `admin-all.jpg` | every registration, with the clickable post link and the notification state |
| `admin-not-notified.jpg` | the **Notification not sent** filter, with its Retry buttons |
