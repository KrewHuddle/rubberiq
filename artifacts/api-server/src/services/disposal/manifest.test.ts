import { describe, expect, it } from 'vitest';
import { esc, selectManifestTemplate } from './manifest.js';

describe('manifest · esc()', () => {
  it('escapes HTML metacharacters', () => {
    expect(esc('<script>alert("x")</script>')).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;',
    );
  });
  it('escapes ampersand and apostrophe', () => {
    expect(esc(`A & B's tires`)).toBe('A &amp; B&#39;s tires');
  });
  it('returns empty string for null/undefined', () => {
    expect(esc(null)).toBe('');
    expect(esc(undefined)).toBe('');
  });
  it('passes through safe text unchanged', () => {
    expect(esc('Plain text 225/65R17')).toBe('Plain text 225/65R17');
  });
});

describe('manifest · selectManifestTemplate()', () => {
  it('PA hauler → PA Act 90', () => {
    expect(selectManifestTemplate('PA')).toBe('PA');
  });
  it('NC hauler → NC Scrap-Tire Cert', () => {
    expect(selectManifestTemplate('NC')).toBe('NC');
  });
  it('any non-PA state defaults NC', () => {
    expect(selectManifestTemplate('VA')).toBe('NC');
    expect(selectManifestTemplate('TX')).toBe('NC');
  });
  it('null/undefined hauler state defaults NC', () => {
    expect(selectManifestTemplate(null)).toBe('NC');
    expect(selectManifestTemplate(undefined)).toBe('NC');
  });
});
