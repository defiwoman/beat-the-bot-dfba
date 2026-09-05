/**
 * Registration validation and wallet masking.
 *
 * The same module runs in the browser and in the Netlify Function, so these cases cover both
 * sides at once — a rule proved here is a rule the server enforces.
 */

import { describe, expect, it } from 'vitest';
import {
  CONSENT_VERSION,
  PLAYER_NAME_MAX,
  REGISTRATION_MESSAGES,
  X_POST_URL_MAX,
  canonicalizeXQuotePostUrl,
  firstInvalidField,
  maskWalletAddress,
  normalizePlayerName,
  normalizeWalletAddress,
  parseRegistration,
  parseXQuotePostUrl,
  validatePlayerName,
  validateRegistration,
  validateWalletAddress,
  validateXQuotePostUrl,
  xQuotePostId,
} from './registration';

/** A plausible base58 public address. Invented for the tests; it is not anyone's wallet. */
const WALLET = '8HvPq3nFbKcT9wRzYtA6sJ2mXeD4uL7gQ1vNhZxK9xQa';

/** A well-formed post link. The status id is invented; it addresses no real post. */
const POST_ID = '1934567890123456789';
const POST_URL = `https://x.com/adalovelace/status/${POST_ID}`;

const VALID = {
  playerName: 'Ada Lovelace',
  fogoWalletAddress: WALLET,
  xQuotePostUrl: POST_URL,
  consent: true,
};

/* ═════════════════════════════════════════════════════════ player name ═════ */

describe('player name', () => {
  it('accepts an ordinary name', () => {
    expect(validatePlayerName('Ada')).toBeUndefined();
  });

  it('requires something', () => {
    expect(validatePlayerName('   ')).toBe(REGISTRATION_MESSAGES.nameRequired);
  });

  it('enforces the length bounds', () => {
    expect(validatePlayerName('A')).toBe(REGISTRATION_MESSAGES.nameTooShort);
    expect(validatePlayerName('x'.repeat(PLAYER_NAME_MAX + 1))).toBe(
      REGISTRATION_MESSAGES.nameTooLong,
    );
  });

  it('collapses internal whitespace and trims the ends', () => {
    expect(normalizePlayerName('  Ada    Lovelace  ')).toBe('Ada Lovelace');
  });

  /**
   * The leaderboard renders names as React text nodes, which escape by construction — this is
   * belt as well as braces, keeping markup out of the column in the first place.
   */
  it('rejects markup', () => {
    expect(validatePlayerName('<script>alert(1)</script>')).toBe(
      REGISTRATION_MESSAGES.nameInvalid,
    );
    expect(validatePlayerName('<img src=x onerror=alert(1)>')).toBe(
      REGISTRATION_MESSAGES.nameInvalid,
    );
  });

  it('rejects control characters', () => {
    expect(validatePlayerName('Ada\u0007Lovelace')).toBe(REGISTRATION_MESSAGES.nameInvalid);
    expect(validatePlayerName('Ada\u0000Lovelace')).toBe(REGISTRATION_MESSAGES.nameInvalid);
    expect(validatePlayerName('Ada\u009fLovelace')).toBe(REGISTRATION_MESSAGES.nameInvalid);
  });
});

/* ═══════════════════════════════════════════════════════ wallet address ════ */

describe('fogo wallet address', () => {
  it('accepts a plausible base58 address', () => {
    expect(validateWalletAddress(WALLET)).toBeUndefined();
  });

  it('requires something', () => {
    expect(validateWalletAddress('  ')).toBe(REGISTRATION_MESSAGES.walletRequired);
  });

  /**
   * The single most important property in this file: public keys are case-sensitive, so
   * lower-casing one silently turns a valid address into a different, wrong string.
   */
  it('preserves case exactly', () => {
    expect(normalizeWalletAddress(WALLET)).toBe(WALLET);
    expect(normalizeWalletAddress(`  ${WALLET}  `)).toBe(WALLET);
    expect(normalizeWalletAddress(WALLET)).not.toBe(WALLET.toLowerCase());
  });

  it('trims surrounding whitespace but rejects internal spaces', () => {
    expect(validateWalletAddress(`\t${WALLET}\n`)).toBeUndefined();
    expect(validateWalletAddress('8HvPq3nF bKcT9wRzYtA6sJ2mXeD4uL7gQ1vNhZxK9xQa')).toBe(
      REGISTRATION_MESSAGES.walletSpaces,
    );
  });

  it('enforces a sane length in both directions', () => {
    expect(validateWalletAddress('abc')).toBe(REGISTRATION_MESSAGES.walletTooShort);
    expect(validateWalletAddress('a'.repeat(200))).toBe(REGISTRATION_MESSAGES.walletTooLong);
  });

  it('rejects characters that are not base58', () => {
    // 0, O, I and l are excluded from the alphabet because they read ambiguously.
    expect(validateWalletAddress(WALLET.replace('8', '0'))).toBe(
      REGISTRATION_MESSAGES.walletCharacters,
    );
    expect(validateWalletAddress(`${'a'.repeat(40)}!!`)).toBe(
      REGISTRATION_MESSAGES.walletCharacters,
    );
  });

  it('rejects markup and control characters', () => {
    expect(validateWalletAddress(`<b>${'a'.repeat(40)}</b>`)).toBe(
      REGISTRATION_MESSAGES.walletCharacters,
    );
  });

  it('rejects a URL pasted into the field', () => {
    expect(validateWalletAddress('https://example.com/wallet/abc')).toBeDefined();
  });
});

/* ════════════════════════════════════════════════════ the X quote-post link ══ */

describe('X quote post link — what is accepted', () => {
  it('accepts a plain x.com status link', () => {
    expect(validateXQuotePostUrl(POST_URL)).toBeUndefined();
    expect(parseXQuotePostUrl(POST_URL).post).toEqual({ url: POST_URL, statusId: POST_ID });
  });

  it.each([
    ['www.x.com', `https://www.x.com/adalovelace/status/${POST_ID}`],
    ['twitter.com', `https://twitter.com/adalovelace/status/${POST_ID}`],
    ['www.twitter.com', `https://www.twitter.com/adalovelace/status/${POST_ID}`],
  ])('accepts %s and rewrites it to x.com', (_host, input) => {
    expect(canonicalizeXQuotePostUrl(input)).toBe(POST_URL);
  });

  it('accepts the /i/status/ form X uses for some links', () => {
    expect(canonicalizeXQuotePostUrl(`https://x.com/i/status/${POST_ID}`)).toBe(
      `https://x.com/i/status/${POST_ID}`,
    );
  });

  it('accepts the older /statuses/ spelling', () => {
    expect(canonicalizeXQuotePostUrl(`https://x.com/adalovelace/statuses/${POST_ID}`)).toBe(
      POST_URL,
    );
  });

  it('accepts surrounding whitespace from a careless paste', () => {
    expect(canonicalizeXQuotePostUrl(`  ${POST_URL}  `)).toBe(POST_URL);
  });
});

describe('X quote post link — canonicalization', () => {
  /**
   * The share sheet appends `?s=…&t=…`; a click-through can add `utm_*`. None of it identifies
   * the post, and all of it would defeat a uniqueness constraint placed on the URL — which is
   * exactly why uniqueness is placed on the id instead, and why the query string is dropped.
   */
  it('strips tracking parameters and fragments', () => {
    for (const noisy of [
      `${POST_URL}?s=20&t=aBcDeFgHiJkLmNoP`,
      `${POST_URL}?utm_source=newsletter&utm_medium=email`,
      `${POST_URL}#comments`,
      `${POST_URL}?ref=x#top`,
    ]) {
      expect(canonicalizeXQuotePostUrl(noisy)).toBe(POST_URL);
    }
  });

  it('strips the /photo/1 suffix a link copied from an image carries', () => {
    expect(canonicalizeXQuotePostUrl(`${POST_URL}/photo/1`)).toBe(POST_URL);
    expect(canonicalizeXQuotePostUrl(`${POST_URL}/video/2`)).toBe(POST_URL);
  });

  it('strips a trailing slash', () => {
    expect(canonicalizeXQuotePostUrl(`${POST_URL}/`)).toBe(POST_URL);
  });

  it('reduces every spelling of one post to one status id', () => {
    const spellings = [
      POST_URL,
      `https://www.x.com/adalovelace/status/${POST_ID}`,
      `https://twitter.com/adalovelace/status/${POST_ID}?s=20`,
      `https://x.com/adalovelace/statuses/${POST_ID}/photo/1`,
      `  ${POST_URL}/  `,
    ];

    expect(new Set(spellings.map(xQuotePostId))).toEqual(new Set([POST_ID]));
    // And therefore to one canonical URL, whichever spelling was pasted.
    expect(new Set(spellings.map(canonicalizeXQuotePostUrl)).size).toBe(1);
  });

  it('extracts the status id separately from the URL', () => {
    expect(xQuotePostId(POST_URL)).toBe(POST_ID);
    expect(parseXQuotePostUrl(POST_URL).post?.statusId).toBe(POST_ID);
  });

  /** Two spellings of one id would be two rows for one post. */
  it('refuses a status id padded with a leading zero', () => {
    expect(validateXQuotePostUrl(`https://x.com/ada/status/0${POST_ID}`)).toBe(
      REGISTRATION_MESSAGES.xPostNotAPost,
    );
  });
});

describe('X quote post link — what is rejected', () => {
  it('requires a value', () => {
    expect(validateXQuotePostUrl('')).toBe(REGISTRATION_MESSAGES.xPostRequired);
    expect(validateXQuotePostUrl('   ')).toBe(REGISTRATION_MESSAGES.xPostRequired);
  });

  it('rejects a profile link with no status id', () => {
    expect(validateXQuotePostUrl('https://x.com/adalovelace')).toBe(
      REGISTRATION_MESSAGES.xPostNotAPost,
    );
    expect(validateXQuotePostUrl('https://x.com/adalovelace/')).toBe(
      REGISTRATION_MESSAGES.xPostNotAPost,
    );
    expect(validateXQuotePostUrl('https://x.com/adalovelace/status')).toBe(
      REGISTRATION_MESSAGES.xPostNotAPost,
    );
    expect(validateXQuotePostUrl('https://x.com/adalovelace/status/')).toBe(
      REGISTRATION_MESSAGES.xPostNotAPost,
    );
  });

  it('rejects a homepage', () => {
    expect(validateXQuotePostUrl('https://x.com')).toBe(REGISTRATION_MESSAGES.xPostNotAPost);
    expect(validateXQuotePostUrl('https://x.com/')).toBe(REGISTRATION_MESSAGES.xPostNotAPost);
    expect(validateXQuotePostUrl('https://twitter.com/home')).toBe(
      REGISTRATION_MESSAGES.xPostNotAPost,
    );
  });

  it('rejects a search or hashtag link', () => {
    expect(validateXQuotePostUrl('https://x.com/search?q=dfba')).toBe(
      REGISTRATION_MESSAGES.xPostNotAPost,
    );
    expect(validateXQuotePostUrl('https://x.com/hashtag/DFBA?src=hashtag_click')).toBe(
      REGISTRATION_MESSAGES.xPostNotAPost,
    );
  });

  it('rejects another website, however plausible the path', () => {
    expect(validateXQuotePostUrl(`https://example.com/adalovelace/status/${POST_ID}`)).toBe(
      REGISTRATION_MESSAGES.xPostHost,
    );
    // A lookalike host that merely ends in the right letters.
    expect(validateXQuotePostUrl(`https://notx.com/ada/status/${POST_ID}`)).toBe(
      REGISTRATION_MESSAGES.xPostHost,
    );
    // A subdomain that is not on the list, including X's own mobile one.
    expect(validateXQuotePostUrl(`https://mobile.x.com/ada/status/${POST_ID}`)).toBe(
      REGISTRATION_MESSAGES.xPostHost,
    );
    // The real host, pushed into the path of somebody else's.
    expect(validateXQuotePostUrl(`https://evil.example/x.com/ada/status/${POST_ID}`)).toBe(
      REGISTRATION_MESSAGES.xPostHost,
    );
  });

  it('rejects URL shorteners, which hide where they point', () => {
    for (const short of [
      'https://t.co/abc123',
      'https://bit.ly/3xyzABC',
      'https://tinyurl.com/beatthebot',
    ]) {
      expect(validateXQuotePostUrl(short)).toBe(REGISTRATION_MESSAGES.xPostHost);
    }
  });

  it('rejects plain text that is not a URL', () => {
    expect(validateXQuotePostUrl('I posted about it, promise')).toBe(
      REGISTRATION_MESSAGES.xPostInvalid,
    );
    // Short scraps still parse as a bare host, so they are turned away at the allowlist.
    expect(validateXQuotePostUrl('n/a')).toBe(REGISTRATION_MESSAGES.xPostHost);
    // The status id on its own is not a link, however right the digits are.
    expect(validateXQuotePostUrl(POST_ID)).toBe(REGISTRATION_MESSAGES.xPostInvalid);
  });

  it('rejects a javascript: URL', () => {
    expect(validateXQuotePostUrl('javascript:alert(1)')).toBe(REGISTRATION_MESSAGES.xPostInvalid);
    // Including one wearing the right host inside its payload.
    expect(validateXQuotePostUrl('javascript:location="https://x.com/a/status/1"')).toBe(
      REGISTRATION_MESSAGES.xPostInvalid,
    );
  });

  it('rejects data:, file: and every other scheme', () => {
    for (const scheme of [
      'data:text/html,alert(1)',
      'file:///etc/passwd',
      'ftp://x.com/ada/status/1',
      'vbscript:msgbox(1)',
    ]) {
      expect(validateXQuotePostUrl(scheme)).toBe(REGISTRATION_MESSAGES.xPostInvalid);
    }
  });

  it('rejects plain http, and says which link to use', () => {
    expect(validateXQuotePostUrl(`http://x.com/adalovelace/status/${POST_ID}`)).toBe(
      REGISTRATION_MESSAGES.xPostInsecure,
    );
  });

  it('rejects markup and script content', () => {
    expect(validateXQuotePostUrl(`<a href="${POST_URL}">post</a>`)).toBe(
      REGISTRATION_MESSAGES.xPostInvalid,
    );
    expect(validateXQuotePostUrl('<script>alert(1)</script>')).toBe(
      REGISTRATION_MESSAGES.xPostInvalid,
    );
    expect(validateXQuotePostUrl('<img src=x onerror=alert(1)>')).toBe(
      REGISTRATION_MESSAGES.xPostInvalid,
    );
  });

  it('rejects internal whitespace and control characters', () => {
    expect(validateXQuotePostUrl(`https://x.com/ada /status/${POST_ID}`)).toBe(
      REGISTRATION_MESSAGES.xPostInvalid,
    );
    expect(validateXQuotePostUrl(`https://x.com/ada/status/${POST_ID}\u0007`)).toBe(
      REGISTRATION_MESSAGES.xPostInvalid,
    );
  });

  it('rejects credentials embedded in the URL', () => {
    expect(validateXQuotePostUrl(`https://x.com:pass@evil.example/a/status/${POST_ID}`)).toBe(
      REGISTRATION_MESSAGES.xPostInvalid,
    );
  });

  it('rejects a link long enough to be a paste of something else', () => {
    expect(validateXQuotePostUrl(`${POST_URL}?q=${'x'.repeat(X_POST_URL_MAX)}`)).toBe(
      REGISTRATION_MESSAGES.xPostTooLong,
    );
  });
});

describe('X quote post link — what the wording promises', () => {
  /**
   * Nothing in this project calls the X API or fetches the post, so no message may suggest the
   * post itself was looked at. "Enter a valid link" is a claim about a string; "we checked your
   * post" would be a claim about the world, and it would be false.
   */
  it('never claims the post has been checked, found or verified', () => {
    const claims = /verif|confirm|checked your|we found|approved/i;
    for (const message of [
      REGISTRATION_MESSAGES.xPostRequired,
      REGISTRATION_MESSAGES.xPostTooLong,
      REGISTRATION_MESSAGES.xPostInsecure,
      REGISTRATION_MESSAGES.xPostHost,
      REGISTRATION_MESSAGES.xPostNotAPost,
      REGISTRATION_MESSAGES.xPostInvalid,
      REGISTRATION_MESSAGES.xPostDuplicate,
    ]) {
      expect(message).not.toMatch(claims);
    }
  });

  /** Fixed wording, so the server's 409 and this module can never drift apart. */
  it('has exactly one duplicate message', () => {
    expect(REGISTRATION_MESSAGES.xPostDuplicate).toBe(
      'This X post has already been used for a leaderboard entry.',
    );
  });

  /** It names the post, not the person who used it — the endpoint is not a lookup. */
  it('does not identify whoever registered the post first', () => {
    expect(REGISTRATION_MESSAGES.xPostDuplicate).not.toMatch(/player name|wallet|score/i);
  });
});

/* ═══════════════════════════════════════════════════════════════ consent ═══ */

describe('consent', () => {
  it('is required', () => {
    const errors = validateRegistration({ ...VALID, consent: false });
    expect(errors.consent).toBe(REGISTRATION_MESSAGES.consentRequired);
  });

  it('records the version that was agreed to', () => {
    const parsed = parseRegistration(VALID);
    expect(parsed.value?.consentVersion).toBe(CONSENT_VERSION);
    expect(CONSENT_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}\.v\d+$/);
  });
});

/* ═══════════════════════════════════════════════════════ the whole form ════ */

describe('the form as a whole', () => {
  it('accepts a complete, valid submission', () => {
    const parsed = parseRegistration(VALID);
    expect(parsed.errors).toBeNull();
    expect(parsed.value).toEqual({
      playerName: 'Ada Lovelace',
      fogoWalletAddress: WALLET,
      xQuotePostUrl: POST_URL,
      xQuotePostId: POST_ID,
      consentVersion: CONSENT_VERSION,
    });
  });

  it('reports every problem at once', () => {
    const errors = validateRegistration({
      playerName: '',
      fogoWalletAddress: '',
      xQuotePostUrl: '',
      consent: false,
    });
    expect(Object.keys(errors).sort()).toEqual([
      'consent',
      'fogoWalletAddress',
      'playerName',
      'xQuotePostUrl',
    ]);
  });

  /** All four are required. There is no field the form will let someone skip. */
  it('refuses a submission missing any one of the four fields', () => {
    for (const field of ['playerName', 'fogoWalletAddress', 'xQuotePostUrl'] as const) {
      const parsed = parseRegistration({ ...VALID, [field]: '' });
      expect(parsed.value).toBeNull();
      expect(parsed.errors?.[field]).toBeDefined();
    }
    expect(parseRegistration({ ...VALID, consent: false }).value).toBeNull();
  });

  it('names the first invalid field in form order, so focus can move there', () => {
    expect(
      firstInvalidField(validateRegistration({ ...VALID, playerName: '' })),
    ).toBe('playerName');
    expect(
      firstInvalidField(validateRegistration({ ...VALID, fogoWalletAddress: 'nope' })),
    ).toBe('fogoWalletAddress');
    expect(
      firstInvalidField(validateRegistration({ ...VALID, xQuotePostUrl: 'nope' })),
    ).toBe('xQuotePostUrl');
    expect(firstInvalidField(validateRegistration({ ...VALID, consent: false }))).toBe('consent');

    // Two wrong at once still names the earlier one, so focus lands at the top of the form.
    expect(
      firstInvalidField(validateRegistration({ ...VALID, playerName: '', xQuotePostUrl: '' })),
    ).toBe('playerName');
    expect(firstInvalidField({})).toBeNull();
  });

  /** No email, no handle, no phone, no key material — four fields and no more. */
  it('asks for nothing beyond a name, an address, a post link and consent', () => {
    const parsed = parseRegistration(VALID);
    expect(Object.keys(parsed.value!).sort()).toEqual([
      'consentVersion',
      'fogoWalletAddress',
      'playerName',
      'xQuotePostId',
      'xQuotePostUrl',
    ]);
  });
});

/* ═════════════════════════════════════════════════════════════ masking ═════ */

describe('wallet masking', () => {
  it('shows exactly the first four and last four characters', () => {
    expect(maskWalletAddress(WALLET)).toBe(`${WALLET.slice(0, 4)}…${WALLET.slice(-4)}`);
    expect(maskWalletAddress(WALLET)).toBe('8HvP…9xQa');
  });

  it('hides everything in between', () => {
    const masked = maskWalletAddress(WALLET);
    const middle = WALLET.slice(4, -4);
    expect(masked).not.toContain(middle);
    expect(masked.length).toBeLessThan(WALLET.length);
  });

  it('never contains the complete address', () => {
    expect(maskWalletAddress(WALLET)).not.toContain(WALLET);
  });

  it('preserves the case of the characters it does show', () => {
    expect(maskWalletAddress(WALLET).startsWith('8HvP')).toBe(true);
  });

  it('refuses to partially mask a value too short for masking to mean anything', () => {
    expect(maskWalletAddress('short')).toBe('…');
    expect(maskWalletAddress('12345678901')).toBe('…');
  });
});
