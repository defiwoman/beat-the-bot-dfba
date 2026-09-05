import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  claimScore as claimScoreRequest,
  completeAttempt,
  startAttempt,
  validateSession,
  type ApiPlayer,
} from '@/lib/leaderboardApi';
import {
  clearCredentials,
  readCredentials,
  writeCredentials,
  type PlayerCredentials,
} from '@/lib/playerCredentials';
import {
  clearPendingResult,
  hasExpiredPendingResult,
  readPendingResult,
  writePendingResult,
} from '@/lib/pendingResult';
import type { AttemptTranscript } from '@/lib/attempt';
import type { RegistrationInput } from '@/lib/registration';
import {
  PlayerContext,
  type ActiveSession,
  type ClaimState,
  type PlayerStatus,
  type SaveState,
} from './playerContext';

/**
 * Who is playing, and what has happened to their score.
 *
 * Registration moved to after the game, which changes the shape of this provider rather than
 * its principles. It still owns three things:
 *
 *   1. Credentials, read from localStorage on mount and validated against the server — because
 *      a stored id whose player no longer exists must not be treated as a player.
 *   2. The active session and its server-issued seed. It no longer needs credentials to open
 *      one: an anonymous session is the normal case.
 *   3. What happened to the finished game. For a recognised player that is a saved attempt.
 *      For everyone else it is an unclaimed result plus the one-time token that can claim it.
 *
 * Nothing here computes or sends a score. `submitAttempt` posts choices; `claimScore` posts a
 * name and a token. The number in both answers is the server's.
 */

const IDLE_SAVE: SaveState = { status: 'idle', result: null, errorCode: null };
const IDLE_CLAIM: ClaimState = { status: 'none', result: null, errorCode: null, fields: null };

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<PlayerStatus>('checking');
  const [player, setPlayer] = useState<ApiPlayer | null>(null);
  const [rank, setRank] = useState<number | null>(null);
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [save, setSave] = useState<SaveState>(IDLE_SAVE);
  const [claim, setClaim] = useState<ClaimState>(IDLE_CLAIM);

  const credentialsRef = useRef<PlayerCredentials | null>(null);
  /**
   * The last transcript submitted, kept so a retry can re-send it. Paired with the session id
   * it belongs to: the server treats a repeat of the same session as idempotent, so a retry
   * can never create a second attempt.
   */
  const pendingRef = useRef<{ sessionId: string; transcript: AttemptTranscript } | null>(null);
  /** The unclaimed result: which session, and the token that can claim it. */
  const claimableRef = useRef<{ sessionId: string; claimToken: string } | null>(null);

  /* ── On mount: is there a usable player, and an unclaimed result? ──────────────── */

  useEffect(() => {
    let cancelled = false;

    /**
     * A result left over from a previous visit. It survives a refresh and a trip to X, which
     * is the whole point — the form asks for a link the player has to leave the page to make.
     */
    const pending = readPendingResult();
    if (pending) {
      claimableRef.current = { sessionId: pending.sessionId, claimToken: pending.claimToken };
      setClaim({ status: 'unclaimed', result: null, errorCode: null, fields: null });
    } else if (hasExpiredPendingResult()) {
      clearPendingResult();
      setClaim({ status: 'expired', result: null, errorCode: null, fields: null });
    }

    const stored = readCredentials();

    if (!stored) {
      setStatus('anonymous');
      return;
    }

    credentialsRef.current = stored;

    void validateSession(stored).then((result) => {
      if (cancelled) return;

      if (result.ok) {
        setPlayer(result.data.player);
        setRank(result.data.rank);
        setStatus('registered');
        return;
      }

      /**
       * Credentials the server rejects are dead weight, so they are cleared — but only on an
       * actual rejection. A network failure leaves them in place, because a player offline for
       * a moment has not stopped being registered.
       */
      if (result.code === 'credentials_invalid') {
        clearCredentials();
        credentialsRef.current = null;
      }
      setStatus('anonymous');
    });

    return () => {
      cancelled = true;
    };
  }, []);

  /* ── Sessions ─────────────────────────────────────────────────────────────────── */

  const beginAttempt = useCallback(async () => {
    // Credentials when we have them, nothing when we do not. Both open a session.
    const result = await startAttempt(credentialsRef.current);

    if (!result.ok) {
      setSession(null);
      return false;
    }

    setSession({ ...result.data.session, attributed: result.data.attributed });
    setSave(IDLE_SAVE);
    setClaim(IDLE_CLAIM);
    pendingRef.current = null;
    claimableRef.current = null;
    // A new game supersedes any result the player never claimed.
    clearPendingResult();
    return true;
  }, []);

  /* ── Submitting a finished game ───────────────────────────────────────────────── */

  const send = useCallback(async (sessionId: string, transcript: AttemptTranscript) => {
    setSave((current) => ({ ...current, status: 'saving', errorCode: null }));

    const credentials = credentialsRef.current;
    const result = await completeAttempt({
      ...(credentials ?? {}),
      sessionId,
      transcript,
    });

    if (!result.ok) {
      // The result stays on screen and the copy never claims it was saved.
      setSave({ status: 'failed', result: null, errorCode: result.code });
      return;
    }

    pendingRef.current = null;
    setSave({ status: 'saved', result: result.data, errorCode: null });

    /**
     * An anonymous result: the server scored it and handed back a token. Remember both, so the
     * form below the result card has something to claim — and so a refresh does not lose it.
     */
    if (result.data.claim) {
      claimableRef.current = { sessionId, claimToken: result.data.claim.claimToken };
      writePendingResult({
        sessionId,
        claimToken: result.data.claim.claimToken,
        expiresAt: result.data.claim.expiresAt,
      });
      setClaim({ status: 'unclaimed', result: null, errorCode: null, fields: null });
      return;
    }

    // An attributed result is already an attempt: the personal best and rank come back with it.
    setRank(result.data.rank);
    setPlayer((current) =>
      current
        ? {
            ...current,
            bestScore: result.data.personalBest,
            attemptsCompleted: result.data.attemptNumber ?? current.attemptsCompleted,
          }
        : current,
    );
  }, []);

  const submitAttempt = useCallback(
    async (transcript: AttemptTranscript) => {
      if (!session) return;
      pendingRef.current = { sessionId: session.sessionId, transcript };
      await send(session.sessionId, transcript);
    },
    [send, session],
  );

  const retrySubmit = useCallback(async () => {
    const pending = pendingRef.current;
    if (!pending) return;
    // Same session id as the first attempt, which is what makes the retry idempotent.
    await send(pending.sessionId, pending.transcript);
  }, [send]);

  /* ── Claiming an anonymous result ─────────────────────────────────────────────── */

  const claimScore = useCallback(async (input: RegistrationInput) => {
    const claimable = claimableRef.current;
    if (!claimable) {
      setClaim({ status: 'expired', result: null, errorCode: null, fields: null });
      return { ok: false as const, code: 'result_expired' };
    }

    setClaim((current) => ({ ...current, status: 'claiming', errorCode: null, fields: null }));

    const credentials = credentialsRef.current;
    const result = await claimScoreRequest({
      sessionId: claimable.sessionId,
      claimToken: claimable.claimToken,
      playerName: input.playerName,
      fogoWalletAddress: input.fogoWalletAddress,
      xQuotePostUrl: input.xQuotePostUrl,
      consent: input.consent,
      ...(credentials ?? {}),
    });

    if (!result.ok) {
      /**
       * A result the server will not honour any more. The token is not consumed by a failure,
       * so anything else is worth retrying with the same values — but this one is not.
       */
      const gone = result.code === 'result_expired' || result.code === 'result_already_claimed';
      if (gone) {
        claimableRef.current = null;
        clearPendingResult();
      }

      setClaim({
        status: gone ? 'expired' : 'unclaimed',
        result: null,
        errorCode: result.code,
        fields: result.fields ?? null,
      });
      return { ok: false as const, code: result.code, fields: result.fields };
    }

    // Claimed. The token has done its one job.
    claimableRef.current = null;
    clearPendingResult();

    if (result.data.accessToken && result.data.player) {
      const credential = {
        playerId: result.data.player.playerId,
        accessToken: result.data.accessToken,
      };
      credentialsRef.current = credential;
      // Written only after the server confirmed the registration.
      writeCredentials(credential);
    }

    if (result.data.player) setPlayer(result.data.player);
    setRank(result.data.rank);
    setStatus('registered');
    setClaim({ status: 'claimed', result: result.data, errorCode: null, fields: null });

    return { ok: true as const };
  }, []);

  /* ── Housekeeping ─────────────────────────────────────────────────────────────── */

  const changePlayer = useCallback(() => {
    clearCredentials();
    clearPendingResult();
    credentialsRef.current = null;
    pendingRef.current = null;
    claimableRef.current = null;
    setPlayer(null);
    setRank(null);
    setSession(null);
    setSave(IDLE_SAVE);
    setClaim(IDLE_CLAIM);
    setStatus('anonymous');
  }, []);

  const resetSave = useCallback(() => {
    setSave(IDLE_SAVE);
    setClaim(IDLE_CLAIM);
    pendingRef.current = null;
  }, []);

  const value = useMemo(
    () => ({
      status,
      player,
      rank,
      session,
      save,
      claim,
      beginAttempt,
      submitAttempt,
      retrySubmit,
      claimScore,
      changePlayer,
      resetSave,
    }),
    [
      status,
      player,
      rank,
      session,
      save,
      claim,
      beginAttempt,
      submitAttempt,
      retrySubmit,
      claimScore,
      changePlayer,
      resetSave,
    ],
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}
