// CORS header middleware for the API pipeline onion (Phase 8 of
// docs/api-pipeline/). Two allow classes: 'api' reflects an allow-listed
// realm/native-app origin (credentialed bearer-token routes), 'public' always
// answers with the wildcard (uncredentialed public reads, e.g. the character
// sheet and avatar art; see realm.ts's isPublicCorsPath). Headers are set via
// ctx.res.setHeader BEFORE calling next(), so a downstream error/429 response
// mapped by withErrors still carries the CORS headers.

import { REALM_ORIGINS } from '../../realm';
import { NATIVE_APP_ORIGINS } from '../../web_login_guard';
import type { Ctx, Middleware, Next } from '../types';

/** 'api' reflects an allow-listed origin; 'public' always answers with '*'. */
export type OriginAllowClass = 'api' | 'public';

const CORS_ALLOW_HEADERS = 'Authorization, Content-Type';
const CORS_MAX_AGE = '600';
const API_ALLOW_METHODS = 'GET, POST, DELETE, OPTIONS';
const PUBLIC_ALLOW_METHODS = 'GET, OPTIONS';

/** The default 'api' allow check: a configured realm origin or a native app shell. */
function defaultApiAllow(origin: string): boolean {
  return REALM_ORIGINS.has(origin) || NATIVE_APP_ORIGINS.has(origin);
}

function setCorsHeaders(ctx: Ctx, origin: string, methods: string): void {
  ctx.res.setHeader('Access-Control-Allow-Origin', origin);
  ctx.res.setHeader('Vary', 'Origin');
  ctx.res.setHeader('Access-Control-Allow-Methods', methods);
  ctx.res.setHeader('Access-Control-Allow-Headers', CORS_ALLOW_HEADERS);
  ctx.res.setHeader('Access-Control-Max-Age', CORS_MAX_AGE);
}

/**
 * Build the CORS middleware for `allowClass`. For 'api', the request Origin is
 * reflected only when isAllowedOrigin (default: a REALM_ORIGINS or
 * NATIVE_APP_ORIGINS member) accepts it; a disallowed or absent Origin gets no
 * Access-Control-Allow-Origin at all. For 'public', the wildcard is set
 * unconditionally, regardless of isAllowedOrigin.
 */
export function withCors(
  allowClass: OriginAllowClass,
  isAllowedOrigin: (origin: string) => boolean = defaultApiAllow,
): Middleware {
  return (ctx: Ctx, next: Next): Promise<void> => {
    if (allowClass === 'public') {
      setCorsHeaders(ctx, '*', PUBLIC_ALLOW_METHODS);
    } else {
      const origin = ctx.req.headers.origin;
      if (typeof origin === 'string' && isAllowedOrigin(origin)) {
        setCorsHeaders(ctx, origin, API_ALLOW_METHODS);
      }
    }
    return next();
  };
}
