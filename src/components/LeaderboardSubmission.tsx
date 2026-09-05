import { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  ExternalLink,
  Link2,
  RefreshCw,
  ShieldAlert,
  Trophy,
} from 'lucide-react';
import { Button } from './Button';
import { copy } from '@/content/copy';
import { campaignPostUrl } from '@/lib/campaignPost';
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
 * SAVE YOUR SCORE TO THE LEADERBOARD — the section below the result card.
 *
 * Registration happens here now, after the game rather than before it. That ordering is the
 * point: a first-time visitor plays without handing over anything, sees what they scored, and
 * only then decides whether to put a name to it.
 *
 * It never covers the result. It is a section further down the same page, after the card and
 * after the download and share controls — which is deliberate, because the form asks for a link
 * to a post the player has to make from that shared card.
 *
 * Five states, one component:
 *
 *   unclaimed   the form (the ordinary first-time ending)
 *   claiming    the same form, disabled, while the claim is in flight
 *   claimed     SCORE ADDED, with the score, best, rank and masked wallet
 *   expired     the token has run out; only a new game can produce a new one
 *   attributed  a recognised player's replay, which saved itself and needs no form
 *
 * Nothing here sends a score. The form posts a name, a wallet, a post link, consent and a
 * one-time token; the number that comes back is the one the server computed when the game
 * ended, and there is no field in the request it could have been substituted through.
 */

const EMPTY: RegistrationInput = {
  playerName: '',
  fogoWalletAddress: '',
  xQuotePostUrl: '',
  consent: false,
};

/** The badge every field carries. Four fields, four of these, no optional field to confuse it. */
function Required() {
  return (
    <span className="field__required" aria-hidden="true">
      {copy.registration.requiredIndicator}
    </span>
  );
}

/** SCORE ADDED. What the leaderboard now holds, said back to the player. */
function ScoreAdded() {
  const { claim } = usePlayer();
  const result = claim.result;
  if (!result) return null;

  return (
    <section className="panel savescore savescore--saved" aria-label={copy.scoreAdded.heading}>
      <p className="savescore__saved" role="status">
        <Check size={16} aria-hidden="true" /> {copy.scoreAdded.heading}
      </p>

      <dl className="savescore__stats">
        <div>
          <dt>{copy.scoreAdded.finalScoreLabel}</dt>
          <dd className="mono">{result.finalScore}</dd>
        </div>
        <div>
          <dt>{copy.scoreAdded.personalBestLabel}</dt>
          <dd className="mono">{result.personalBest}</dd>
        </div>
        <div>
          <dt>{copy.scoreAdded.rankLabel}</dt>
          <dd className="mono">
            {result.rank === null ? copy.scoreAdded.unranked : `#${result.rank}`}
          </dd>
        </div>
        <div>
          <dt>{copy.scoreAdded.walletLabel}</dt>
          {/*
            Masked by the server before it was ever sent here. The complete address is not in
            this payload, so there is nothing on this screen to un-mask.
          */}
          <dd className="mono">{result.maskedWallet}</dd>
        </div>
      </dl>

      {result.isNewPersonalBest ? (
        <p className="savescore__best">
          <Trophy size={14} aria-hidden="true" /> {copy.scoreAdded.newPersonalBest}
        </p>
      ) : null}
    </section>
  );
}

export function LeaderboardSubmission() {
  const { status, save, claim, claimScore, retrySubmit } = usePlayer();

  const headingId = useId();
  const nameId = useId();
  const walletId = useId();
  const xPostId = useId();
  const consentId = useId();

  const [values, setValues] = useState<RegistrationInput>(EMPTY);
  const [errors, setErrors] = useState<RegistrationErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  /** Errors only appear after a submit, so the form does not shout while someone is typing. */
  const [submitted, setSubmitted] = useState(false);
  /**
   * Which field to focus once the render carrying the new errors has landed.
   *
   * Focus cannot be moved from the submit handler directly: while a submission is in flight
   * every input is `disabled`, and a disabled input silently refuses focus. By the time the
   * server answers, the inputs are still disabled in the DOM — React has not re-rendered — so
   * the request is recorded here and carried out in the effect below.
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

  const submitting = claim.status === 'claiming';

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

      const result = await claimScore(values);
      if (result.ok) return;

      if (result.fields) {
        // The server can reject a field the browser accepted — a wallet or a post already
        // used — so its answer lands on the same field and takes focus the same way.
        setErrors(result.fields as RegistrationErrors);
        setFocusField(firstInvalidField(result.fields as RegistrationErrors));
        return;
      }

      /**
       * The claim did not go through. The token was not consumed, every typed value is still
       * on screen, and the result is still there — so this says exactly that and invites
       * another press rather than pretending anything was saved.
       */
      setFormError(copy.registration.saveFailed);
    },
    [claimScore, submitting, values],
  );

  useEffect(() => {
    if (!focusField) return;
    fieldRefs[focusField].current?.focus();
    setFocusField(null);
    // fieldRefs is a stable object of refs; listing it would re-run this every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusField]);

  const errorFor = (field: keyof RegistrationInput) => (submitted ? errors[field] : undefined);

  /* ── The states that are not a form ─────────────────────────────────────────── */

  if (claim.status === 'claimed') return <ScoreAdded />;

  if (claim.status === 'expired') {
    return (
      <section className="panel savescore savescore--failed" aria-label={copy.registration.expired}>
        <p className="savescore__failed" role="status">
          <AlertTriangle size={16} aria-hidden="true" /> {copy.registration.expired}
        </p>
      </section>
    );
  }

  /**
   * A recognised player's replay. The session already belonged to them, so completing it saved
   * the attempt outright — there is nothing to fill in.
   */
  if (claim.status === 'none' && status === 'registered') {
    if (save.status === 'failed') {
      return (
        <section
          className="panel savescore savescore--failed"
          aria-label={copy.saveScore.failedLabel}
        >
          {/* `alert` because a score the player believes is saved, and is not, matters. */}
          <p className="savescore__failed" role="alert">
            <AlertTriangle size={16} aria-hidden="true" /> {copy.saveScore.failedLabel}
          </p>
          <p className="panel__body">{copy.saveScore.failedBody}</p>
          <Button
            variant="secondary"
            icon={<RefreshCw size={16} />}
            aria-label={copy.saveScore.retryHint}
            onClick={() => void retrySubmit()}
          >
            {copy.saveScore.retryLabel}
          </Button>
        </section>
      );
    }

    if (save.status === 'saving') {
      return (
        <section className="panel savescore" aria-label={copy.saveScore.savingLabel}>
          <p className="panel__body" role="status">
            {copy.saveScore.savingLabel}
          </p>
        </section>
      );
    }

    if (save.status === 'saved' && save.result) {
      return (
        <section className="panel savescore savescore--saved" aria-label={copy.scoreAdded.heading}>
          <p className="savescore__saved" role="status">
            <Check size={16} aria-hidden="true" /> {copy.scoreAdded.autoSaved}
          </p>
          <dl className="savescore__stats">
            <div>
              <dt>{copy.scoreAdded.finalScoreLabel}</dt>
              <dd className="mono">{save.result.finalScore}</dd>
            </div>
            <div>
              <dt>{copy.scoreAdded.personalBestLabel}</dt>
              <dd className="mono">{save.result.personalBest ?? save.result.finalScore}</dd>
            </div>
            <div>
              <dt>{copy.scoreAdded.rankLabel}</dt>
              <dd className="mono">
                {save.result.rank === null ? copy.scoreAdded.unranked : `#${save.result.rank}`}
              </dd>
            </div>
          </dl>
          {save.result.isNewPersonalBest ? (
            <p className="savescore__best">
              <Trophy size={14} aria-hidden="true" /> {copy.scoreAdded.newPersonalBest}
            </p>
          ) : null}
        </section>
      );
    }

    return null;
  }

  // Nothing to claim and nobody to save for: the game was played without a server session.
  if (claim.status === 'none') return null;

  /* ── The form ───────────────────────────────────────────────────────────────── */

  const campaign = campaignPostUrl();

  return (
    <section className="register register--result" aria-labelledby={headingId}>
      <div>
        <h2 id={headingId} className="register__heading">
          {copy.registration.heading}
        </h2>
        <p className="lede lede--sub">{copy.registration.lede}</p>
      </div>

      {/*
        Only rendered when a campaign post has actually been configured. Nothing is invented:
        an unset or malformed value produces no button at all.
      */}
      {campaign ? (
        <a
          className="btn btn--secondary btn--block"
          href={campaign}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={copy.registration.campaignHint}
        >
          <span className="btn__icon" aria-hidden="true">
            <ExternalLink size={16} />
          </span>
          <span>{copy.registration.campaignLabel}</span>
          <ArrowUpRight size={14} aria-hidden="true" />
        </a>
      ) : null}

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
          icon={<Trophy size={18} />}
          aria-label={copy.registration.submitHint}
          disabled={submitting}
        >
          {submitting ? copy.registration.submittingLabel : copy.registration.submitLabel}
        </Button>
      </form>
    </section>
  );
}
