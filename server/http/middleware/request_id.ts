// Re-establishes the reqId AsyncLocalStorage binding around next() (Phase 8 of
// docs/api-pipeline/). buildContext already sets ctx.reqId and runOnion already
// wraps the whole onion run in runWithReqId, so in the wired Phase 9 pipeline
// this is a redundant rebind; it matters whenever a middleware stack is
// composed and run WITHOUT runOnion (e.g. a focused unit test), where
// currentReqId() would otherwise read undefined downstream.

import { newReqId, runWithReqId } from '../context';
import type { Ctx, Middleware, Next } from '../types';

/**
 * Bind ctx.reqId as the ambient request id for the duration of next(). Falls
 * back to a freshly minted id when ctx.reqId is falsy: the frozen Ctx contract
 * has buildContext/fakeCtx always set a non-empty reqId, so this only guards a
 * degenerate caller; it never writes back onto ctx.reqId (that field is
 * readonly on the frozen Ctx type). Does not echo an X-Request-Id header
 * (Phase 23 owns that).
 */
export function withRequestId(): Middleware {
  return (ctx: Ctx, next: Next): Promise<void> => {
    const reqId = ctx.reqId || newReqId();
    return runWithReqId(reqId, next);
  };
}
