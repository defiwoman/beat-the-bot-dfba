import { createContext } from 'react';
import type { ApiPlayer, CompletionResult } from '@/lib/leaderboardApi';
import type { AttemptTranscript } from '@/lib/attempt';

/** Where the registration gate currently stands. */
export type PlayerStatus =
  /** Credentials are being checked against the server on first load. */
  | 'checking'
  /** No usable credentials — the registration form is what happens next. */
  | 'anonymous'
  /** Registered and authenticated in this browser. */
  | 'registered';

export interface ActiveSession {
  sessionId: string;
  /** Drives the round builders, so the server can rebuild identical rounds when scoring. */
  seed: number;
  expiresAt: string;
}

export interface SaveState {
  status: 'idle' | 'saving' | 'saved' | 'failed';
  result: CompletionResult | null;
  /** Why the last save failed, for the retry panel. Never shown as if the save succeeded. */
  errorCode: string | null;
}

export interface PlayerContextValue {
  status: PlayerStatus;
  player: ApiPlayer | null;
  rank: number | null;
  session: ActiveSession | null;
  save: SaveState;

  register: (input: {
    playerName: string;
    fogoWalletAddress: string;
    consent: boolean;
  }) => Promise<{ ok: true } | { ok: false; code: string; fields?: Record<string, string> }>;

  /** Ask the server for a fresh seed. Resolves false when no session could be opened. */
  beginAttempt: () => Promise<boolean>;

  /** Submit a finished game. The transcript carries choices only — never a score. */
  submitAttempt: (transcript: AttemptTranscript) => Promise<void>;

  /** Re-send the last transcript after a failed save, without creating a second attempt. */
  retrySubmit: () => Promise<void>;

  /** Clear this app's credentials only, and show the form again. */
  changePlayer: () => void;

  /** Drop the finished-attempt state when a new game starts. */
  resetSave: () => void;
}

export const PlayerContext = createContext<PlayerContextValue | null>(null);
