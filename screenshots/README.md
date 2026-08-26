# Release audit screenshots

Captured with Playwright/Chromium against `npm run build` + `vite preview`, driving the whole
game end to end with both mouse and keyboard at four viewports: **360×800**, **390×844**,
**768×1024** and **1440×900**.

Two of those viewports are captured here — a phone (`390x844-*`) and a desktop (`1440x900-*`).
The other two were played through with the same assertions but not photographed.

| File | Shows |
| --- | --- |
| `*-1-opening.jpg` | Opening screen with the co-branded hero lockup above the title |
| `*-2-level1-prepare.jpg` | Level 1 preparation phase — LONG and SHORT disabled and visibly muted |
| `*-3-level1-signal.jpg` | Level 1 signal reveal with the decision countdown visible |
| `*-4-level1-result.jpg` | Level 1 result — correct read, bot first, manual Next round |
| `*-5-level2-tutorial.jpg` | Level 2 tutorial, titled "The Dual Flow Batch Auction" |
| `*-6-level2-prism.jpg` | Level 2 gameplay under the SUPERLUMINAL PRISM MODE banner |
| `*-7-level3.jpg` | Level 3, Market Maker Survival |
| `*-8-results.jpg` | Final results screen with the branded result card |
| `*-9-share-card.jpg` | The **downloaded PNG** itself, re-encoded for this folder |

The `-9-share-card` files are the real exported card — the walkthrough clicks **Save PNG**,
captures the download and checks it is a non-trivial image, which is how the export is verified
to carry the genuine local brand assets rather than two empty boxes.

Images are half-scale JPEGs so the audit record stays small in the repository. Nothing here is
shipped with the app.
