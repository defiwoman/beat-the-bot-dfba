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
  firstInvalidField,
  maskWalletAddress,
  normalizePlayerName,
  normalizeWalletAddress,
  parseRegistration,
  validatePlayerName,
  validateRegistration,
  validateWalletAddress,
} from './registration';

/** A plausible base58 public address. Invented for the tests; it is not anyone's wallet. */
const WALLET = '8HvPq3nFbKcT9wRzYtA6sJ2mXeD4uL7gQ1vNhZxK9xQa';

const VALID = { playerName: 'Ada Lovelace', fogoWalletAddress: WALLET, consent: true };

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
      consentVersion: CONSENT_VERSION,
    });
  });

  it('reports every problem at once', () => {
    const errors = validateRegistration({ playerName: '', fogoWalletAddress: '', consent: false });
    expect(Object.keys(errors).sort()).toEqual(['consent', 'fogoWalletAddress', 'playerName']);
  });

  it('names the first invalid field in form order, so focus can move there', () => {
    expect(
      firstInvalidField(validateRegistration({ ...VALID, playerName: '' })),
    ).toBe('playerName');
    expect(
      firstInvalidField(validateRegistration({ ...VALID, fogoWalletAddress: 'nope' })),
    ).toBe('fogoWalletAddress');
    expect(firstInvalidField(validateRegistration({ ...VALID, consent: false }))).toBe('consent');
    expect(firstInvalidField({})).toBeNull();
  });

  /** No email, no handle, no phone, no key material — the form has three fields and no more. */
  it('asks for nothing beyond a name, an address and consent', () => {
    const parsed = parseRegistration(VALID);
    expect(Object.keys(parsed.value!).sort()).toEqual([
      'consentVersion',
      'fogoWalletAddress',
      'playerName',
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
