import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { AlertTriangle, ArrowRight, Link2, ShieldAlert } from 'lucide-react';
import { Button } from './Button';
import { copy } from '@/content/copy';
import {
  PLAYER_NAME_MAX,
  WALLET_MAX,
  X_POST_URL_MAX,
  firstInvalidField,
  validateRegistration,
  type RegistrationErrors,
  type RegistrationInput,
} from '@/lib/registration';
import { usePlayer } from '@/state/usePlayer';

/**
 * PLAYER REGISTRATION — rendered directly on the opening screen.
 *
 * It is not a dialog and it is not behind a button. A first-time visitor sees it as part of the
 * homepage, below the three-level summary, and its submit button IS the primary call to action:
 * there is no separate START GAME for someone who has not registered, because there is nothing
 * for that button to do.
 *
 * That is the whole point of the change. When registration lived behind START GAME, a visitor
 * had to press one button to discover a form; worse, the button was the only thing standing
 * between them and Level 1, so any path that reached `START_GAME` without going through the
 * form was a bypass. Now the form is the path.
 *
 * Four fields, all required. No email, no handle, no phone, and no wallet connection: this form
 * types text into inputs and that is the entire interaction. Nothing here touches a wallet,
 * requests a signature or makes an on-chain call — and nothing fetches the submitted post or
 * asks X about it, so the link is recorded rather than verified.
 *
 * What the player typed is never thrown away. A rejected submission — invalid field, duplicate
 * wallet, duplicate post, database unreachable — leaves every value in place so the retry is
 * one click, not a re-type.
 */

const EMPTY: RegistrationInput = {
  playerName: '',
  fogoWalletAddress: '',
  xQuotePostUrl: '',
  consent: false,
};

/**
 * The badge every field carries. Four fields, four of these, no optional field to confuse it.
 *
 * `aria-hidden` because it is the visual half of the signal only: the inputs carry `required`,
 * which is what a screen reader announces. Without it the badge would be read as part of each
 * field's name — "player name required" — and then announced again from the input.
 */
function Required() {
  return (
    <span className="field__required" aria-hidden="true">
      {copy.registration.requiredIndicator}
    </span>
  );
}

export function RegistrationForm({ onRegistered }: { onRegistered: () => void }) {
  const { register } = usePlayer();

  const headingId = useId();
  const nameId = useId();
  const walletId = useId();
  const xPostId = useId();
  const consentId = useId();

  const [values, setValues] = useState<RegistrationInput>(EMPTY);
  const [errors, setErrors] = useState<RegistrationErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  /** Errors only appear after a submit, so the form does not shout while someone is typing. */
  const [submitted, setSubmitted] = useState(false);
  /**
   * Which field to move focus to once the render carrying the new errors has landed.
   *
   * Focus cannot be moved from the submit handler directly: while a submission is in flight
   * every input is `disabled`, and a disabled input silently refuses focus. By the time the
   * server's answer arrives the inputs are still disabled in the DOM — React has not
   * re-rendered yet — so the request is recorded here and carried out in the effect below,
   * after the fields are interactive again.
   */
  const [focusField, setFocusField] = useState<keyof RegistrationInput | null>(null);

  const nameRef = useRef<HTMLInputElement>(null);
  const walletRef = useRef<HTMLInputElement>(null);
  const xPostRef = useRef<HTMLInputElement>(null);
  const consentRef = useRef<HTMLInputElement>(null);

  const fieldRefs = {
    playerName: nameRef,
    fogoWalletAddress: walletRef,
    xQuotePostUrl: xPostRef,
    consent: consentRef,
  } as const;

  const update = useCallback(
    <K extends keyof RegistrationInput>(field: K, value: RegistrationInput[K]) => {
      setValues((current) => ({ ...current, [field]: value }));
      // Clear a field's error as soon as it is touched again.
      setErrors((current) => ({ ...current, [field]: undefined }));
    },
    [],
  );

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      // Guards a double-click and a second Enter press on the same submission.
      if (submitting) return;

      setSubmitted(true);
      setFormError(null);

      const found = validateRegistration(values);
      if (Object.keys(found).length > 0) {
        setErrors(found);
        setFocusField(firstInvalidField(found));
        return;
      }

      setSubmitting(true);
      const result = await register(values);
      setSubmitting(false);

      if (result.ok) {
        onRegistered();
        return;
      }

      if (result.fields) {
        // The server can reject a field the browser accepted — a wallet or a post already
        // registered — so its answer lands on the same field and takes focus the same way.
        setErrors(result.fields as RegistrationErrors);
        setFocusField(firstInvalidField(result.fields as RegistrationErrors));
        return;
      }

      /**
       * Something below the form failed: the network, the function, or the database.
       *
       * The values stay exactly as typed, the player stays on this screen, and the game does
       * not start. There is no unregistered fallback to slip into — an unreachable database
       * means the score could not be recorded, which is the whole reason to register.
       */
      setFormError(
        result.code === 'network_error' || result.code === 'timeout'
          ? copy.registration.networkError
          : result.code === 'database_unavailable'
            ? copy.registration.unavailable
            : copy.registration.serverError,
      );
    },
    [onRegistered, register, submitting, values],
  );

  useEffect(() => {
    if (!focusField) return;
    fieldRefs[focusField].current?.focus();
    setFocusField(null);
    // fieldRefs is a stable object of refs; listing it would re-run this every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusField]);

  const errorFor = (field: keyof RegistrationInput) => (submitted ? errors[field] : undefined);

  return (
    <section className="register register--inline" aria-labelledby={headingId}>
      <div>
        <h2 id={headingId} className="register__heading">
          {copy.registration.heading}
        </h2>
        <p className="lede lede--sub">{copy.registration.lede}</p>
      </div>

      <form className="register__form" onSubmit={handleSubmit} noValidate>
        {/* ── Player name ── */}
        <div className="field">
          <label className="field__label" htmlFor={nameId}>
            {copy.registration.nameLabel}
            <Required />
          </label>
          <input
            id={nameId}
            ref={nameRef}
            className={errorFor('playerName') ? 'field__input field__input--bad' : 'field__input'}
            type="text"
            name="playerName"
            required
            value={values.playerName}
            maxLength={PLAYER_NAME_MAX}
            autoComplete="nickname"
            placeholder={copy.registration.namePlaceholder}
            aria-describedby={`${nameId}-help${errorFor('playerName') ? ` ${nameId}-error` : ''}`}
            aria-invalid={errorFor('playerName') ? true : undefined}
            onChange={(event) => update('playerName', event.target.value)}
            disabled={submitting}
          />
          <p id={`${nameId}-help`} className="field__help">
            {copy.registration.nameHelp}
          </p>
          {errorFor('playerName') ? (
            <p id={`${nameId}-error`} className="field__error">
              <AlertTriangle size={13} aria-hidden="true" /> {errorFor('playerName')}
            </p>
          ) : null}
        </div>

        {/* ── Fogo wallet address ── */}
        <div className="field">
          <label className="field__label" htmlFor={walletId}>
            {copy.registration.walletLabel}
            <Required />
          </label>
          <input
            id={walletId}
            ref={walletRef}
            className={
              errorFor('fogoWalletAddress')
                ? 'field__input field__input--mono field__input--bad'
                : 'field__input field__input--mono'
            }
            type="text"
            name="fogoWalletAddress"
            required
            value={values.fogoWalletAddress}
            maxLength={WALLET_MAX}
            /* Off for all four: an address is not a word, a name or a saved credential. */
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder={copy.registration.walletPlaceholder}
            aria-describedby={`${walletId}-help ${walletId}-note${errorFor('fogoWalletAddress') ? ` ${walletId}-error` : ''}`}
            aria-invalid={errorFor('fogoWalletAddress') ? true : undefined}
            onChange={(event) => update('fogoWalletAddress', event.target.value)}
            disabled={submitting}
          />
          <p id={`${walletId}-help`} className="field__help field__help--warn">
            <ShieldAlert size={13} aria-hidden="true" /> {copy.registration.walletHelp}
          </p>
          <p id={`${walletId}-note`} className="field__help">
            {copy.registration.walletNote}
          </p>
          {errorFor('fogoWalletAddress') ? (
            <p id={`${walletId}-error`} className="field__error">
              <AlertTriangle size={13} aria-hidden="true" /> {errorFor('fogoWalletAddress')}
            </p>
          ) : null}
        </div>

        {/* ── X quote post link ── */}
        <div className="field">
          <label className="field__label" htmlFor={xPostId}>
            {copy.registration.xPostLabel}
            <Required />
          </label>
          <input
            id={xPostId}
            ref={xPostRef}
            className={
              errorFor('xQuotePostUrl')
                ? 'field__input field__input--mono field__input--bad'
                : 'field__input field__input--mono'
            }
            type="url"
            name="xQuotePostUrl"
            required
            value={values.xQuotePostUrl}
            maxLength={X_POST_URL_MAX}
            inputMode="url"
            /* A URL is not a word and not a saved credential. */
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder={copy.registration.xPostPlaceholder}
            aria-describedby={`${xPostId}-help ${xPostId}-note${errorFor('xQuotePostUrl') ? ` ${xPostId}-error` : ''}`}
            aria-invalid={errorFor('xQuotePostUrl') ? true : undefined}
            onChange={(event) => update('xQuotePostUrl', event.target.value)}
            disabled={submitting}
          />
          <p id={`${xPostId}-help`} className="field__help">
            <Link2 size={13} aria-hidden="true" /> {copy.registration.xPostHelp}
          </p>
          <p id={`${xPostId}-note`} className="field__help">
            {copy.registration.xPostNote}
          </p>
          {errorFor('xQuotePostUrl') ? (
            <p id={`${xPostId}-error`} className="field__error">
              <AlertTriangle size={13} aria-hidden="true" /> {errorFor('xQuotePostUrl')}
            </p>
          ) : null}
        </div>

        {/* ── Consent ── */}
        <div className="field">
          <label className="field__consent" htmlFor={consentId}>
            <input
              id={consentId}
              ref={consentRef}
              type="checkbox"
              name="consent"
              required
              checked={values.consent}
              aria-describedby={errorFor('consent') ? `${consentId}-error` : undefined}
              aria-invalid={errorFor('consent') ? true : undefined}
              onChange={(event) => update('consent', event.target.checked)}
              disabled={submitting}
            />
            <span>
              {copy.registration.consentLabel}
              <Required />
            </span>
          </label>
          {errorFor('consent') ? (
            <p id={`${consentId}-error`} className="field__error">
              <AlertTriangle size={13} aria-hidden="true" /> {errorFor('consent')}
            </p>
          ) : null}
        </div>

        {formError ? (
          <p className="field__error field__error--form" role="alert">
            <AlertTriangle size={14} aria-hidden="true" /> {formError}
          </p>
        ) : null}

        <Button
          block
          jumbo
          type="submit"
          icon={<ArrowRight size={20} />}
          aria-label={copy.registration.submitHint}
          disabled={submitting}
        >
          {submitting ? copy.registration.submittingLabel : copy.registration.submitLabel}
        </Button>
      </form>
    </section>
  );
}
