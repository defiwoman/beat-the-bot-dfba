/**
 * Registration validation — one implementation, run twice.
 *
 * The browser imports this to show inline errors as the player types; the Netlify Function
 * imports the same file and runs it again on whatever actually arrives. Client-side validation
 * is a convenience and is never trusted: a request that skips the form entirely gets exactly
 * the same treatment.
 *
 * Pure and dependency-free on purpose, so the function bundle can take it verbatim.
 *
 * ── About the wallet address ──────────────────────────────────────────────────────────────
 *
 * This module checks that the submitted string is *shaped* like a public address. That is all
 * it can do. Nothing here — and nothing anywhere in this project — connects a wallet, requests
 * a signature, reads a balance or makes an on-chain call, so a value that passes these checks
 * has been recorded, not verified. See README → "What the wallet address is and is not".
 *
 * ── About the X quote-post link ───────────────────────────────────────────────
 *
 * The same is true of the post link. This module checks that the URL *addresses* a post on X:
 * the right host, HTTPS, and a numeric status id in the path. It does not fetch the post, does
 * not call the X API, and cannot tell whether the post exists, is public, is still there, or
 * says anything at all about Beat the Bot. A stored link is a claim, not a verification.
 */

/** Bumped if the consent wording changes, so stored consent always names what was agreed to. */
export const CONSENT_VERSION = '2026-09-04.v2';

export const PLAYER_NAME_MIN = 2;
export const PLAYER_NAME_MAX = 32;

/**
 * Public addresses on SVM-compatible chains are base58 and land in the low-to-mid 40s of
 * characters. The bounds are deliberately loose — this is a format sanity check that keeps
 * junk and pasted paragraphs out of the column, not an assertion about any particular chain.
 */
export const WALLET_MIN = 32;
export const WALLET_MAX = 64;

/** Base58: the Bitcoin/Solana alphabet, with 0 O I l omitted because they read ambiguously. */
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]+$/;

/**
 * Anything in the C0/C1 control ranges, which have no business in a display name or an address.
 * Matching control characters is the entire point here, so the lint rule against them is the
 * thing that is wrong in this one spot.
 */
// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/;

/** A cheap tell for someone pasting markup rather than a name. */
const MARKUP = /[<>]/;

export interface RegistrationInput {
  playerName: string;
  fogoWalletAddress: string;
  xQuotePostUrl: string;
  consent: boolean;
}

/** Field name → message. Empty means the submission is good. */
export type RegistrationErrors = Partial<Record<keyof RegistrationInput, string>>;

export interface NormalizedRegistration {
  playerName: string;
  fogoWalletAddress: string;
  /** Always rebuilt as `https://x.com/<handle>/status/<id>` — never the string as pasted. */
  xQuotePostUrl: string;
  /** The status id on its own. This, not the URL, is what uniqueness is enforced on. */
  xQuotePostId: string;
  consentVersion: string;
}

export const REGISTRATION_MESSAGES = {
  nameRequired: 'Enter a player name.',
  nameTooShort: `Use at least ${PLAYER_NAME_MIN} characters.`,
  nameTooLong: `Use ${PLAYER_NAME_MAX} characters or fewer.`,
  nameInvalid: 'Use plain text only — no markup or special control characters.',
  walletRequired: 'Enter your public Fogo wallet address.',
  walletSpaces: 'An address cannot contain spaces.',
  walletTooShort: 'That address looks too short to be a Fogo address.',
  walletTooLong: 'That address looks too long to be a Fogo address.',
  walletCharacters: 'That is not a valid Fogo address format.',
  xPostRequired: 'Paste the link to your X quote post.',
  xPostTooLong: 'That link is too long to be a post link.',
  xPostInsecure: 'Use the https:// link to your post.',
  xPostHost: 'Only links from x.com or twitter.com are accepted.',
  xPostNotAPost:
    'That link does not point to a single post. Copy the link to the quote post itself, not to a profile, a search or a homepage.',
  xPostInvalid: 'Enter a link like https://x.com/username/status/1234567890123456789.',
  /**
   * Returned by the server when the status id is already on another registration. The wording
   * is fixed: it names the post, never the player who used it first.
   */
  xPostDuplicate: 'This X post has already been used for a player registration.',
  consentRequired: 'Please confirm to continue.',
} as const;

/**
 * Collapse internal runs of whitespace and trim the ends.
 *
 * A display name is rendered next to other players' names, so "Ada    Lovelace" becoming
 * "Ada Lovelace" keeps the leaderboard tidy without rejecting anyone's input.
 */
export function normalizePlayerName(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim();
}

/**
 * Trim only.
 *
 * Case is preserved exactly: base58 public keys are case-sensitive, and lower-casing one would
 * silently turn a valid address into a different, wrong string.
 */
export function normalizeWalletAddress(raw: string): string {
  return raw.trim();
}

export function validatePlayerName(raw: string): string | undefined {
  const name = normalizePlayerName(raw);
  if (name.length === 0) return REGISTRATION_MESSAGES.nameRequired;
  if (CONTROL_CHARACTERS.test(name) || MARKUP.test(name)) return REGISTRATION_MESSAGES.nameInvalid;
  if (name.length < PLAYER_NAME_MIN) return REGISTRATION_MESSAGES.nameTooShort;
  if (name.length > PLAYER_NAME_MAX) return REGISTRATION_MESSAGES.nameTooLong;
  return undefined;
}

export function validateWalletAddress(raw: string): string | undefined {
  const address = normalizeWalletAddress(raw);
  if (address.length === 0) return REGISTRATION_MESSAGES.walletRequired;
  // Checked before length so a pasted "addr with spaces" gets the accurate message.
  if (/\s/.test(address)) return REGISTRATION_MESSAGES.walletSpaces;
  if (CONTROL_CHARACTERS.test(address) || MARKUP.test(address)) {
    return REGISTRATION_MESSAGES.walletCharacters;
  }
  if (address.length < WALLET_MIN) return REGISTRATION_MESSAGES.walletTooShort;
  if (address.length > WALLET_MAX) return REGISTRATION_MESSAGES.walletTooLong;
  if (!BASE58.test(address)) return REGISTRATION_MESSAGES.walletCharacters;
  return undefined;
}

/* ══════════════════════════════════════════════════ the X quote-post link ══ */

/**
 * The only hosts a post link may come from. `twitter.com` is still handed out by old clients
 * and by anyone with a stale bookmark, so it is accepted and rewritten rather than refused.
 *
 * Everything else is refused, including `mobile.x.com`, `nitter.*`, every link shortener and
 * every other website: a shortener hides where it actually points, and this module has no way
 * to follow it.
 */
export const X_POST_HOSTS: readonly string[] = ['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'];

/** The canonical host every accepted link is rewritten to. */
export const X_CANONICAL_HOST = 'x.com';

/** Far above a real post link (~60 characters) and far below a pasted document. */
export const X_POST_URL_MAX = 300;

/**
 * `/<handle>/status/<id>`, optionally with the `/photo/1`-style suffix X adds when the link is
 * copied from a specific image or video in the post. `statuses` is the older spelling.
 *
 * The handle rules are X's own: 1–15 characters of letters, digits and underscores. `i` is
 * included by that, which is what makes `x.com/i/status/<id>` work.
 *
 * A path that does not match this is not a post: a bare profile, a homepage, `/search`,
 * `/hashtag/...` and `/i/lists/...` all fall out here.
 */
const X_STATUS_PATH = /^\/([A-Za-z0-9_]{1,15})\/status(?:es)?\/(\d{1,25})(?:\/(?:photo|video|analytics)\/\d+)?\/?$/;

export interface XQuotePost {
  /** `https://x.com/<handle>/status/<id>` — no query string, no fragment, no tracking. */
  url: string;
  statusId: string;
}

/**
 * Validate, then canonicalize.
 *
 * Canonicalization is what makes the uniqueness constraint mean something. The same post can be
 * pasted as `twitter.com`, as `www.x.com`, with `?s=20&t=...` appended by the share sheet, with
 * a `#` fragment, or with a `/photo/1` suffix — all five are the same post, and all five reduce
 * to the same status id and the same canonical URL here.
 *
 * The query string is dropped entirely rather than filtered against a list of known tracking
 * parameters: nothing in a post's query string identifies the post, so there is nothing worth
 * keeping and no list to fall behind.
 *
 * What this does NOT do: fetch the URL, call the X API, or check that the post exists, is
 * public, or mentions this game. Nothing about a stored link has been automatically verified.
 */
export function parseXQuotePostUrl(
  raw: string,
): { post: XQuotePost; error: undefined } | { post: null; error: string } {
  const value = raw.trim();

  if (value.length === 0) return { post: null, error: REGISTRATION_MESSAGES.xPostRequired };
  if (value.length > X_POST_URL_MAX) {
    return { post: null, error: REGISTRATION_MESSAGES.xPostTooLong };
  }
  // Markup, control characters and internal whitespace are rejected before parsing, so a
  // pasted `<a href=...>` or a javascript: payload never reaches the URL constructor.
  if (CONTROL_CHARACTERS.test(value) || MARKUP.test(value) || /\s/.test(value)) {
    return { post: null, error: REGISTRATION_MESSAGES.xPostInvalid };
  }

  const scheme = /^([A-Za-z][A-Za-z0-9+.-]*):/.exec(value)?.[1]?.toLowerCase();
  if (scheme === 'http') return { post: null, error: REGISTRATION_MESSAGES.xPostInsecure };
  // Anything with a scheme that is not https is refused outright — javascript:, data:, file:,
  // ftp: and the rest never get as far as the host check.
  if (scheme !== undefined && scheme !== 'https') {
    return { post: null, error: REGISTRATION_MESSAGES.xPostInvalid };
  }

  let url: URL;
  try {
    // A bare `x.com/user/status/123` is treated as the https link it plainly means. Every other
    // check below still applies, so this is leniency about typing, not about what is accepted.
    url = new URL(scheme === undefined ? `https://${value}` : value);
  } catch {
    return { post: null, error: REGISTRATION_MESSAGES.xPostInvalid };
  }

  if (url.protocol !== 'https:') return { post: null, error: REGISTRATION_MESSAGES.xPostInsecure };
  // `username:password@` in a URL is a phishing shape and has no business on a post link.
  if (url.username !== '' || url.password !== '') {
    return { post: null, error: REGISTRATION_MESSAGES.xPostInvalid };
  }
  // `url.host` keeps a port; the allowlist is hostnames, and a port on x.com is not a real link.
  if (url.port !== '') return { post: null, error: REGISTRATION_MESSAGES.xPostHost };
  if (!X_POST_HOSTS.includes(url.hostname.toLowerCase())) {
    return { post: null, error: REGISTRATION_MESSAGES.xPostHost };
  }

  const match = X_STATUS_PATH.exec(url.pathname);
  if (!match) return { post: null, error: REGISTRATION_MESSAGES.xPostNotAPost };

  const [, handle, statusId] = match;
  // A leading zero would let one post register twice under two spellings of its id.
  if (statusId.length > 1 && statusId.startsWith('0')) {
    return { post: null, error: REGISTRATION_MESSAGES.xPostNotAPost };
  }

  return {
    post: { url: `https://${X_CANONICAL_HOST}/${handle}/status/${statusId}`, statusId },
    error: undefined,
  };
}

/** The canonical URL, or `null` if the input is not an acceptable post link. */
export function canonicalizeXQuotePostUrl(raw: string): string | null {
  return parseXQuotePostUrl(raw).post?.url ?? null;
}

/** The status id on its own, or `null`. This is the value uniqueness is enforced on. */
export function xQuotePostId(raw: string): string | null {
  return parseXQuotePostUrl(raw).post?.statusId ?? null;
}

export function validateXQuotePostUrl(raw: string): string | undefined {
  return parseXQuotePostUrl(raw).error;
}

/** Every field checked at once, in the order they appear in the form. */
export function validateRegistration(input: RegistrationInput): RegistrationErrors {
  const errors: RegistrationErrors = {};

  const nameError = validatePlayerName(input.playerName);
  if (nameError) errors.playerName = nameError;

  const walletError = validateWalletAddress(input.fogoWalletAddress);
  if (walletError) errors.fogoWalletAddress = walletError;

  const postError = validateXQuotePostUrl(input.xQuotePostUrl);
  if (postError) errors.xQuotePostUrl = postError;

  if (!input.consent) errors.consent = REGISTRATION_MESSAGES.consentRequired;

  return errors;
}

/** The order the form renders in, so focus can move to the first thing that is wrong. */
export const REGISTRATION_FIELD_ORDER: readonly (keyof RegistrationInput)[] = [
  'playerName',
  'fogoWalletAddress',
  'xQuotePostUrl',
  'consent',
];

export function firstInvalidField(errors: RegistrationErrors): keyof RegistrationInput | null {
  return REGISTRATION_FIELD_ORDER.find((field) => errors[field] !== undefined) ?? null;
}

/**
 * Validate and normalize in one step. `null` means the input was rejected — the caller reports
 * `errors`; a non-null `value` is what gets written to the database.
 */
export function parseRegistration(
  input: RegistrationInput,
): { value: NormalizedRegistration; errors: null } | { value: null; errors: RegistrationErrors } {
  const errors = validateRegistration(input);
  if (Object.keys(errors).length > 0) return { value: null, errors };

  // Non-null by construction: validateRegistration returned no error for this field.
  const post = parseXQuotePostUrl(input.xQuotePostUrl).post!;

  return {
    value: {
      playerName: normalizePlayerName(input.playerName),
      fogoWalletAddress: normalizeWalletAddress(input.fogoWalletAddress),
      xQuotePostUrl: post.url,
      xQuotePostId: post.statusId,
      consentVersion: CONSENT_VERSION,
    },
    errors: null,
  };
}

/**
 * The only form of a wallet address the public is ever shown: first four, ellipsis, last four.
 *
 * The masking happens on the server, in the leaderboard query's projection — the full address
 * is never in the JSON that reaches the browser, so there is nothing in the page source, the
 * network panel or a data attribute to un-mask.
 */
export function maskWalletAddress(address: string): string {
  const value = address.trim();
  // Too short to mask meaningfully: showing 4+4 of a 9-character string reveals almost all of
  // it, so anything that small is replaced outright rather than partially hidden.
  if (value.length < 12) return '…';
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}
