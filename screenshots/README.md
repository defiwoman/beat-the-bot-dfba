# Visual audit screenshots

Captured with Playwright/Chromium against `npm run build` + `vite preview`, playing the whole
game end to end with both mouse and keyboard at four viewports: **360×800**, **390×844**,
**768×1024** and **1440×900**.

Two of those viewports are photographed — a phone (`390x844-*`) and a desktop (`1440x900-*`).
The other two were played through with the same assertions but not captured.

| File | Shows |
| --- | --- |
| `*-1-opening.jpg` | Opening screen: co-branded hero panel, split title, neon 40ms card, neon CTA |
| `*-2-level1-prepare.jpg` | Level 1 preparation — LONG and SHORT disabled and visibly muted |
| `*-3-level1-result.jpg` | Level 1 result: Fogo bot latency, emerald success, neon Next round |
| `*-4-level2-signal.jpg` | Level 2 signal under the SUPERLUMINAL PRISM MODE banner |
| `*-5-level2-batch-replay.jpg` | Batch Replay: orange bot, neon player, grey makers |
| `*-6-two-auctions.jpg` | Two-auction explanation, both cards in the Superluminal family |
| `*-7-level3.jpg` | Level 3, Market Maker Survival |
| `*-8-results.jpg` | Final results screen |
| `*-9-share-card.jpg` | The **downloaded PNG** itself, re-encoded for this folder |

## What the walkthrough asserts

Alongside the captures, every one of the nine states at every one of the four viewports is
checked for:

- **Prominent blue or cyan.** Every painted element's computed `color`, `background-color`,
  border colours, `fill`, `stroke`, every `rgba()` inside `background-image` and `box-shadow`
  is sampled and rejected if blue dominates (`b > 120 && b > r + 40 && b > g + 20`) at an alpha
  a viewer would actually see. This catches blue hiding inside a gradient, which a text search
  of the source cannot.
- Console and page errors.
- Horizontal overflow.
- Start Game above the fold.
- Direction buttons genuinely disabled during preparation, enabled after the signal.
- The signal name and its explanation staying clear of the countdown.
- Logos loading, unstretched, and inlined as data URIs on the result card.
- Save PNG producing a real image rather than an empty box.

Images are half-scale JPEGs so the audit record stays small in the repository. Nothing here is
shipped with the app.
