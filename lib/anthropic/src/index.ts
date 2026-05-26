/**
 * Anthropic client — central wiring for vision intake (Module 4) and
 * multilingual content generation (listings/NL matching/manifest assist).
 *
 * MODEL DEFAULTS (spec calls out: build AI apps on latest/most capable Claude):
 *   - vision/intake:   claude-opus-4-7      (top accuracy on sidewall/DOT)
 *   - text generation: claude-sonnet-4-6    (fast, multilingual content)
 *
 * Pull current Anthropic docs before changing model IDs.
 */
import Anthropic from '@anthropic-ai/sdk';

let _client: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (!_client) {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error('ANTHROPIC_API_KEY not set');
    _client = new Anthropic({ apiKey: key });
  }
  return _client;
}

export const MODELS = {
  vision: 'claude-opus-4-7',
  text: 'claude-sonnet-4-6',
} as const;

export type SupportedLang = 'en' | 'es';
