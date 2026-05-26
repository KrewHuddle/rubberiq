/**
 * Server-side i18n — used for AI-generated content (listings, NL matching,
 * manifest assist) and generated docs (sale liability, age disclosure).
 *
 * Compliance forms are NOT generated here — they use official state bilingual
 * PDFs (NC Scrap Tire Certification, etc.). This i18n covers the custom
 * disclosures that get bolted onto a sale.
 */
import i18next from 'i18next';
import FsBackend from 'i18next-fs-backend';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const SUPPORTED_LOCALES = ['en', 'es'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export async function initI18n(): Promise<void> {
  await i18next.use(FsBackend).init({
    fallbackLng: 'en',
    supportedLngs: SUPPORTED_LOCALES as unknown as string[],
    preload: SUPPORTED_LOCALES as unknown as string[],
    ns: ['doc', 'listing', 'errors'],
    defaultNS: 'doc',
    backend: {
      loadPath: path.join(__dirname, 'locales/{{lng}}/{{ns}}.json'),
    },
  });
}

export function t(key: string, lang: Locale, vars?: Record<string, unknown>): string {
  return i18next.t(key, { lng: lang, ...(vars ?? {}) }) as string;
}
