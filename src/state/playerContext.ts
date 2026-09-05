import { createContext } from 'react';
import type { ApiPlayer, ClaimResult, CompletionResult } from '@/lib/leaderboardApi';
import type { RegistrationInput } from '@/lib/registration';
import type { AttemptTranscript } from '@/lib/attempt';

/** Where the player stands with the server. */
export type PlayerStatus =
  /** Credentials are being checked against the server on first load. */
  | 'checking'
  /** No usable credentials. Play is still available — anonymously. */
  | 'anonymous'
  /** The server recognised this browser's credentials. */
  | 'registered';

export interface ActiveSession {
  sessionId: string;
  /** Drives the round builders, so the server can rebuild identical rounds when scoring. */
  seed: number;
  expiresAt: string;
  /**
   * True when the session already belongs to a player, so completing it saves the attempt
   * outright. False when it is anonymous and the result will need claiming.
   */
  attributed: boolean;
}

export interface SaveState {
  status: 'idle' | 'saving' | 'saved' | 'failed';
  result: CompletionResult | null;
  /** Why the last save failed, for the message the results screen shows. */
  errorCode: string | null;
}

/**
 * The state of claiming an anonymous result.
 *
 * 'unclaimed' is the interesting one: the game is finished, the server holds a verified score,
 * and the form below the result card is the way to put a name to it.
 */
export interface ClaimState {
  status: 'none' | 'unclaimed' | 'claiming' | 'claimed' | 'expired';
  result: ClaimResult | null;
  errorCode: string | null;
  fields: Record<string, string> | null;
}

export interface PlayerContextValue {
  status: PlayerStatus;
  player: ApiPlayer | null;
  rank: number | null;
  session: ActiveSession | null;
  save: SaveState;
  claim: ClaimState;

  /** Open a session. Works with or without credentials — anonymous play is the default path. */
  beginAttempt: () => Promise<boolean>;

  /** Submit a finished game. The transcript carries choices only — never a score. */
  submitAttempt: (transcript: AttemptTranscript) => Promise<void>;

  /** Re-send the last transcript after a failed save, without creating a second attempt. */
  retrySubmit: () => Promise<void>;

  /**
   * Register and attach the finished game to the new player, in one server call.
   *
   * No score is sent. The server reads the one it computed when the game ended.
   */
  claimScore: (
    input: RegistrationInput,
  ) => Promise<{ ok: true } | { ok: false; code: string; fields?: Record<string, string> }>;

  /** Clear this app's credentials only. The next game is played anonymously. */
  changePlayer: () => void;

  /** Drop the finished-attempt state when a new game starts. */
  resetSave: () => void;
}

export const PlayerContext = createContext<PlayerContextValue | null>(null);
