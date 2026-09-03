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
 */

/** Bumped if the consent wording changes, so stored consent always names what was agreed to. */
export const CONSENT_VERSION = '2026-09-03.v1';

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
  consent: boolean;
}

/** Field name → message. Empty means the submission is good. */
export type RegistrationErrors = Partial<Record<keyof RegistrationInput, string>>;

export interface NormalizedRegistration {
  playerName: string;
  fogoWalletAddress: string;
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

/** Every field checked at once, in the order they appear in the form. */
export function validateRegistration(input: RegistrationInput): RegistrationErrors {
  const errors: RegistrationErrors = {};

  const nameError = validatePlayerName(input.playerName);
  if (nameError) errors.playerName = nameError;

  const walletError = validateWalletAddress(input.fogoWalletAddress);
  if (walletError) errors.fogoWalletAddress = walletError;

  if (!input.consent) errors.consent = REGISTRATION_MESSAGES.consentRequired;

  return errors;
}

/** The order the form renders in, so focus can move to the first thing that is wrong. */
export const REGISTRATION_FIELD_ORDER: readonly (keyof RegistrationInput)[] = [
  'playerName',
  'fogoWalletAddress',
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

  return {
    value: {
      playerName: normalizePlayerName(input.playerName),
      fogoWalletAddress: normalizeWalletAddress(input.fogoWalletAddress),
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
