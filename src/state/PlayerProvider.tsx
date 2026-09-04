import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  completeAttempt,
  registerPlayer,
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
import type { AttemptTranscript } from '@/lib/attempt';
import { PlayerContext, type ActiveSession, type PlayerStatus, type SaveState } from './playerContext';

/**
 * Who is playing, and what happened to their last score.
 *
 * The provider owns three things:
 *
 *   1. Credentials. Read from localStorage on mount and validated against the server, because
 *      a stored id whose player no longer exists must show the form rather than fail later.
 *   2. The active game session — the server-issued seed the client builds its rounds from.
 *   3. The state of the last save, including a transcript kept in a ref so a failed submission
 *      can be retried without the player replaying the game.
 *
 * Nothing here ever computes or sends a score. `submitAttempt` posts choices; the number that
 * comes back is the server's.
 */

const IDLE_SAVE: SaveState = { status: 'idle', result: null, errorCode: null };

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<PlayerStatus>('checking');
  const [player, setPlayer] = useState<ApiPlayer | null>(null);
  const [rank, setRank] = useState<number | null>(null);
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [save, setSave] = useState<SaveState>(IDLE_SAVE);

  const credentialsRef = useRef<PlayerCredentials | null>(null);
  /**
   * The last transcript submitted, kept so RETRY SAVING SCORE can re-send it. Paired with the
   * session id it belongs to: the server treats a repeat of the same session as idempotent, so
   * a retry can never create a second attempt.
   */
  const pendingRef = useRef<{ sessionId: string; transcript: AttemptTranscript } | null>(null);

  /* ── On mount: is there a usable player in this browser? ───────────────────────── */

  useEffect(() => {
    let cancelled = false;
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
       * Credentials that the server rejects are dead weight, so they are cleared — but only on
       * an actual rejection. A network failure leaves them in place, because a player offline
       * for a moment has not stopped being registered.
       */
      if (result.code === 'credentials_invalid') {
        clearCredentials();
        credentialsRef.current = null;
        setStatus('anonymous');
      } else {
        // Unreachable server: keep the credentials and let the player try again.
        setStatus('anonymous');
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  /* ── Registration ─────────────────────────────────────────────────────────────── */

  const register = useCallback(
    async (input: {
      playerName: string;
      fogoWalletAddress: string;
      xQuotePostUrl: string;
      consent: boolean;
    }) => {
      const result = await registerPlayer(input);

      if (!result.ok) {
        return { ok: false as const, code: result.code, fields: result.fields };
      }

      const credentials = {
        playerId: result.data.player.playerId,
        accessToken: result.data.accessToken,
      };
      credentialsRef.current = credentials;
      // Written only after the server confirmed the registration.
      writeCredentials(credentials);

      setPlayer(result.data.player);
      setRank(null);
      setStatus('registered');
      return { ok: true as const };
    },
    [],
  );

  /* ── Sessions ─────────────────────────────────────────────────────────────────── */

  const beginAttempt = useCallback(async () => {
    const credentials = credentialsRef.current;
    if (!credentials) return false;

    const result = await startAttempt(credentials);
    if (!result.ok) {
      // The game is still playable without a session; the score simply will not be recorded.
      setSession(null);
      return false;
    }

    setSession(result.data.session);
    setSave(IDLE_SAVE);
    pendingRef.current = null;
    return true;
  }, []);

  /* ── Submitting a finished game ───────────────────────────────────────────────── */

  const send = useCallback(async (sessionId: string, transcript: AttemptTranscript) => {
    const credentials = credentialsRef.current;
    if (!credentials) return;

    setSave((current) => ({ ...current, status: 'saving', errorCode: null }));

    const result = await completeAttempt({ ...credentials, sessionId, transcript });

    if (!result.ok) {
      // The result stays on screen and the copy never claims it was saved.
      setSave({ status: 'failed', result: null, errorCode: result.code });
      return;
    }

    pendingRef.current = null;
    setSave({ status: 'saved', result: result.data, errorCode: null });
    setRank(result.data.rank);
    setPlayer((current) =>
      current
        ? {
            ...current,
            bestScore: result.data.personalBest,
            attemptsCompleted: result.data.attemptNumber,
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

  /* ── Housekeeping ─────────────────────────────────────────────────────────────── */

  const changePlayer = useCallback(() => {
    clearCredentials();
    credentialsRef.current = null;
    pendingRef.current = null;
    setPlayer(null);
    setRank(null);
    setSession(null);
    setSave(IDLE_SAVE);
    setStatus('anonymous');
  }, []);

  const resetSave = useCallback(() => {
    setSave(IDLE_SAVE);
    pendingRef.current = null;
  }, []);

  const value = useMemo(
    () => ({
      status,
      player,
      rank,
      session,
      save,
      register,
      beginAttempt,
      submitAttempt,
      retrySubmit,
      changePlayer,
      resetSave,
    }),
    [
      status,
      player,
      rank,
      session,
      save,
      register,
      beginAttempt,
      submitAttempt,
      retrySubmit,
      changePlayer,
      resetSave,
    ],
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}
