/**
 * The campaign post to quote, if there is one.
 *
 * The form asks the player to write an X *quote* post, which means there has to be something to
 * quote. When the campaign's own post is known, the results screen offers a link straight to
 * it; when it is not, it offers nothing at all rather than a broken or invented link.
 *
 * Configured through `VITE_CAMPAIGN_POST_URL`. That prefix is deliberate and safe here: this is
 * a public link to a public post, the one piece of configuration in this project that genuinely
 * belongs in the browser. Every actual secret — the database URL, the administration token, the
 * notification recipient — stays server-side and is never given a `VITE_` name.
 *
 * The value is put through the same validation a player's link gets. A misconfigured variable
 * therefore behaves exactly like an unset one: no button. This module cannot ship a link to
 * somewhere that is not a post on X, whatever is typed into the dashboard.
 */

import { canonicalizeXQuotePostUrl } from './registration';

export function campaignPostUrl(): string | null {
  const configured = import.meta.env?.VITE_CAMPAIGN_POST_URL;
  if (typeof configured !== 'string' || configured.trim() === '') return null;
  return canonicalizeXQuotePostUrl(configured);
}
