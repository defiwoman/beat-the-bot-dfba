/**
 * WHAT IS NOT INSTALLED.
 *
 * The wallet address is recorded as submitted text and nothing more. No wallet is connected,
 * no signature is requested, no balance is read and no on-chain call is made — so none of the
 * packages that would enable any of that belong in this project.
 *
 * This reads the real `package.json` and the real lockfile, so adding one of them by accident
 * fails the build rather than shipping quietly.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/** vitest runs from the project root, so plain relative paths are the simplest thing here. */
const root = resolve('.');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};
const lockfile = readFileSync(join(root, 'package-lock.json'), 'utf8');

const declared = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };

/** Every family of package that would imply a wallet or on-chain integration. */
const FORBIDDEN = [
  '@solana/web3.js',
  '@solana/addresses',
  '@solana/wallet-adapter-base',
  '@solana/wallet-adapter-react',
  '@solana/wallet-adapter-wallets',
  '@solana/spl-token',
  '@solana-mobile/wallet-adapter-mobile',
  'ethers',
  'web3',
  'viem',
  'wagmi',
  '@walletconnect/client',
  '@walletconnect/web3-provider',
  '@fogo/sessions-sdk',
  'bs58',
  'tweetnacl',
];

describe('no wallet or on-chain integration exists', () => {
  it('declares none of the wallet or chain SDKs as a dependency', () => {
    const found = FORBIDDEN.filter((name) => name in declared);
    expect(found).toEqual([]);
  });

  it('does not pull one in transitively either', () => {
    const found = FORBIDDEN.filter((name) => lockfile.includes(`node_modules/${name}"`));
    expect(found).toEqual([]);
  });

  it('has no wallet adapter of any kind anywhere in the tree', () => {
    expect(lockfile).not.toMatch(/node_modules\/@solana\//);
    expect(lockfile).not.toMatch(/wallet-adapter/);
  });

  /** The one thing that IS installed for the database, so the intent stays legible. */
  it('uses the current Netlify Database package', () => {
    expect(declared).toHaveProperty('@netlify/database');
  });
});

describe('no database credential can reach the browser', () => {
  /** Every file Vite compiles into the browser bundle. */
  function clientSources(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) return clientSources(path);
      return /\.(ts|tsx|html)$/.test(entry) ? [path] : [];
    });
  }

  const SECRETS = ['NETLIFY_DB_URL', 'NETLIFY_DATABASE_URL', 'DATABASE_URL', 'LEADERBOARD_ADMIN_TOKEN'];

  /**
   * Vite only exposes variables prefixed `VITE_`, so a connection string or an admin token
   * behind that prefix would be compiled straight into the bundle.
   */
  it('never prefixes a secret with VITE_', () => {
    const offenders: string[] = [];
    for (const file of [...clientSources(join(root, 'src')), join(root, 'index.html')]) {
      const text = readFileSync(file, 'utf8');
      for (const secret of SECRETS) {
        if (text.includes(`VITE_${secret}`)) offenders.push(`${file}: VITE_${secret}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  /** Stronger still: no client file reads any environment variable or names any secret. */
  it('keeps every server-only name out of the client sources', () => {
    const offenders: string[] = [];
    for (const file of clientSources(join(root, 'src'))) {
      // The dependency audit itself names them, which is the point of it.
      if (file.endsWith('dependencies.test.ts')) continue;
      const text = readFileSync(file, 'utf8');
      for (const secret of SECRETS) {
        if (text.includes(secret)) offenders.push(`${file}: ${secret}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('does not import the database driver from any client source', () => {
    const offenders = clientSources(join(root, 'src')).filter((file) =>
      /from '@netlify\/database'/.test(readFileSync(file, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });
});
