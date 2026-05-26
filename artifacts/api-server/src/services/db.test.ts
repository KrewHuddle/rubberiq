import { describe, expect, it } from 'vitest';
import { buildPoolConfig } from '@rubberiq/db';

describe('buildPoolConfig · URL parser + SSL handling', () => {
  const base = 'postgresql://doadmin:secret@host.do.com:25060/rubberiq';

  it('parses host/port/user/password/database', () => {
    const c = buildPoolConfig(`${base}?sslmode=require`);
    expect(c.host).toBe('host.do.com');
    expect(c.port).toBe(25060);
    expect(c.user).toBe('doadmin');
    expect(c.password).toBe('secret');
    expect(c.database).toBe('rubberiq');
  });

  it('sslmode=require → ssl rejectUnauthorized: false (DO managed Postgres)', () => {
    const c = buildPoolConfig(`${base}?sslmode=require`);
    expect(c.ssl).toEqual({ rejectUnauthorized: false });
  });

  it('sslmode=verify-full → ssl rejectUnauthorized: false (we still skip cert chain)', () => {
    const c = buildPoolConfig(`${base}?sslmode=verify-full`);
    expect(c.ssl).toEqual({ rejectUnauthorized: false });
  });

  it('no sslmode → ssl undefined (local dev)', () => {
    const c = buildPoolConfig('postgresql://user:pw@localhost:5432/dev');
    expect(c.ssl).toBeUndefined();
  });

  it('sslmode=disable → ssl undefined', () => {
    const c = buildPoolConfig(`${base}?sslmode=disable`);
    expect(c.ssl).toBeUndefined();
  });

  it('decodes URL-encoded user + password', () => {
    const c = buildPoolConfig('postgresql://us%40er:p%40ss%2Bword@host:5432/db?sslmode=require');
    expect(c.user).toBe('us@er');
    expect(c.password).toBe('p@ss+word');
  });

  it('defaults port 5432 when omitted', () => {
    const c = buildPoolConfig('postgresql://u:p@host/db');
    expect(c.port).toBe(5432);
  });
});
