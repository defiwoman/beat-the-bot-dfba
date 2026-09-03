import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { AlertTriangle, ArrowRight, ShieldAlert, X } from 'lucide-react';
import { Button } from './Button';
import { copy } from '@/content/copy';
import {
  PLAYER_NAME_MAX,
  WALLET_MAX,
  firstInvalidField,
  validateRegistration,
  type RegistrationErrors,
  type RegistrationInput,
} from '@/lib/registration';
import { usePlayer } from '@/state/usePlayer';

/**
 * PLAYER REGISTRATION.
 *
 * Opens when START GAME is pressed, so the opening screen's hierarchy — co-branding, title,
 * 40ms visual, level summary, CTA — is untouched. Nothing is added above the branding.
 *
 * Three fields and nothing else. No email, no handle, no phone, and no wallet connection: this
 * form types an address into a text input and that is the entire interaction. Nothing here
 * touches a wallet, requests a signature or makes an on-chain call.
 *
 * Accessibility: a labelled modal dialog with focus moved in on open and returned on close,
 * Escape to dismiss, every input tied to its own label, help text and error through
 * aria-describedby, and focus moved to the first invalid field on a rejected submit.
 */

const EMPTY: RegistrationInput = { playerName: '', fogoWalletAddress: '', consent: false };

export function RegistrationPanel({
  onRegistered,
  onCancel,
}: {
  onRegistered: () => void;
  onCancel: () => void;
}) {
  const { register } = usePlayer();
  const reduceMotion = useReducedMotion();

  const headingId = useId();
  const nameId = useId();
  const walletId = useId();
  const consentId = useId();

  const [values, setValues] = useState<RegistrationInput>(EMPTY);
  const [errors, setErrors] = useState<RegistrationErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  /** Errors only appear after a submit, so the form does not shout while someone is typing. */
  const [submitted, setSubmitted] = useState(false);

  const nameRef = useRef<HTMLInputElement>(null);
  const walletRef = useRef<HTMLInputElement>(null);
  const consentRef = useRef<HTMLInputElement>(null);
  const restoreRef = useRef<Element | null>(null);

  const fieldRefs = {
    playerName: nameRef,
    fogoWalletAddress: walletRef,
    consent: consentRef,
  } as const;

  useEffect(() => {
    restoreRef.current = document.activeElement;
    nameRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting) onCancel();
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (restoreRef.current instanceof HTMLElement) restoreRef.current.focus();
    };
  }, [onCancel, submitting]);

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
        const first = firstInvalidField(found);
        if (first) fieldRefs[first].current?.focus();
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
        setErrors(result.fields as RegistrationErrors);
        const first = firstInvalidField(result.fields as RegistrationErrors);
        if (first) fieldRefs[first].current?.focus();
        return;
      }

      setFormError(
        result.code === 'network_error' || result.code === 'timeout'
          ? copy.registration.networkError
          : result.code === 'database_unavailable'
            ? copy.registration.unavailable
            : copy.registration.serverError,
      );
    },
    // fieldRefs is a stable object of refs; listing it would re-create the callback every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onRegistered, register, submitting, values],
  );

  const errorFor = (field: keyof RegistrationInput) => (submitted ? errors[field] : undefined);

  return (
    <div className="about-backdrop" onClick={submitting ? undefined : onCancel}>
      <motion.div
        className="about register"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        onClick={(event) => event.stopPropagation()}
        initial={reduceMotion ? false : { opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.22, ease: 'easeOut' }}
      >
        <button
          type="button"
          className="iconbtn about__close"
          aria-label={copy.registration.cancelHint}
          onClick={onCancel}
          disabled={submitting}
        >
          <X size={20} aria-hidden="true" />
        </button>

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
            </label>
            <input
              id={nameId}
              ref={nameRef}
              className={errorFor('playerName') ? 'field__input field__input--bad' : 'field__input'}
              type="text"
              name="playerName"
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
              value={values.fogoWalletAddress}
              maxLength={WALLET_MAX}
              /* Off for all four: an address is not a word, a name or a saved credential. */
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder={copy.registration.walletPlaceholder}
              aria-describedby={`${walletId}-help${errorFor('fogoWalletAddress') ? ` ${walletId}-error` : ''}`}
              aria-invalid={errorFor('fogoWalletAddress') ? true : undefined}
              onChange={(event) => update('fogoWalletAddress', event.target.value)}
              disabled={submitting}
            />
            <p id={`${walletId}-help`} className="field__help field__help--warn">
              <ShieldAlert size={13} aria-hidden="true" /> {copy.registration.walletHelp}
            </p>
            {errorFor('fogoWalletAddress') ? (
              <p id={`${walletId}-error`} className="field__error">
                <AlertTriangle size={13} aria-hidden="true" /> {errorFor('fogoWalletAddress')}
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
                checked={values.consent}
                aria-describedby={errorFor('consent') ? `${consentId}-error` : undefined}
                aria-invalid={errorFor('consent') ? true : undefined}
                onChange={(event) => update('consent', event.target.checked)}
                disabled={submitting}
              />
              <span>{copy.registration.consentLabel}</span>
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
            type="submit"
            icon={<ArrowRight size={18} />}
            aria-label={copy.registration.submitHint}
            disabled={submitting}
          >
            {submitting ? copy.registration.submittingLabel : copy.registration.submitLabel}
          </Button>
        </form>
      </motion.div>
    </div>
  );
}
