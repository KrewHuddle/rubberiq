/**
 * Web i18n bootstrap (Module 2).
 *
 * HARD RULE: no user-facing string is EVER hardcoded. Everything routes through
 * react-i18next. New strings land in /locales/en/ then translated to es/.
 *
 * Locale precedence at runtime:
 *   1. ?lang= URL param (sales demo, link-shared docs)
 *   2. principal language (users.language for staff, customers.language for docs)
 *   3. shop default (shops.defaultLanguage)
 *   4. 'en'
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enCommon from './en/common.json';
import enAuth from './en/auth.json';
import enIntake from './en/intake.json';
import enDashboard from './en/dashboard.json';
import enLanding from './en/landing.json';
import enAdmin from './en/admin.json';
import esCommon from './es/common.json';
import esAuth from './es/auth.json';
import esIntake from './es/intake.json';
import esDashboard from './es/dashboard.json';
import esLanding from './es/landing.json';
import esAdmin from './es/admin.json';

export const SUPPORTED_LANGS = ['en', 'es'] as const;
export type Lang = (typeof SUPPORTED_LANGS)[number];

export const resources = {
  en: {
    common: enCommon,
    auth: enAuth,
    intake: enIntake,
    dashboard: enDashboard,
    landing: enLanding,
    admin: enAdmin,
  },
  es: {
    common: esCommon,
    auth: esAuth,
    intake: esIntake,
    dashboard: esDashboard,
    landing: esLanding,
    admin: esAdmin,
  },
} as const;

export function initI18n(initialLang: Lang = 'en'): typeof i18n {
  if (!i18n.isInitialized) {
    void i18n.use(initReactI18next).init({
      resources,
      lng: initialLang,
      fallbackLng: 'en',
      defaultNS: 'common',
      ns: ['common', 'auth', 'intake', 'dashboard', 'landing', 'admin'],
      interpolation: { escapeValue: false }, // react already escapes
      returnNull: false,
    });
  }
  return i18n;
}

export function resolveInitialLang(): Lang {
  const url = new URLSearchParams(globalThis.location?.search ?? '');
  const fromUrl = url.get('lang');
  if (fromUrl === 'en' || fromUrl === 'es') return fromUrl;
  try {
    const saved = localStorage.getItem('rb-lang');
    if (saved === 'en' || saved === 'es') return saved;
  } catch {
    /* ignore */
  }
  return (navigator.language?.startsWith('es') ? 'es' : 'en') as Lang;
}
