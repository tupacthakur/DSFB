/**
 * Server environment validation. Never log key values.
 */

const REQUIRED_SERVER_ENV = ['ANTHROPIC_API_KEY'] as const;
const OPTIONAL_SERVER_ENV = ['OPENAI_API_KEY'] as const;

export function validateServerEnv(): void {
  for (const name of REQUIRED_SERVER_ENV) {
    const value = process.env[name];
    if (value === undefined || value === '') {
      throw new Error(`Missing required server env: ${name}. Add it to .env.local`);
    }
  }
  for (const name of OPTIONAL_SERVER_ENV) {
    const value = process.env[name];
    if (value === undefined || value === '') {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn(`Optional server env not set: ${name}`);
      }
    }
  }
}

export function getServerEnv(): { anthropicKey: string; openaiKey: string } {
  return {
    anthropicKey: process.env.ANTHROPIC_API_KEY ?? '',
    openaiKey: process.env.OPENAI_API_KEY ?? '',
  };
}

/** Client-safe: only non-secret config (no API keys). */
export const CLIENT_CONFIG = {
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? 'Koravo',
  version: process.env.NEXT_PUBLIC_APP_VERSION ?? '1.0.0',
} as const;
