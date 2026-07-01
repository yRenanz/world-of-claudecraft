// Unit tests for the withRequestId middleware (server/http/middleware/request_id.ts):
// it re-establishes the reqId AsyncLocalStorage binding around next() so
// currentReqId() reads correctly downstream even when composed WITHOUT runOnion.

import { describe, expect, it } from 'vitest';
import { compose } from '../../../server/http/compose';
import { currentReqId } from '../../../server/http/context';
import { withRequestId } from '../../../server/http/middleware/request_id';
import type { Middleware } from '../../../server/http/types';
import { fakeCtx } from '../helpers/fake_ctx';

describe('withRequestId: binds ctx.reqId as the ambient id', () => {
  it("exposes fakeCtx's preset reqId ('test-req-1') downstream", async () => {
    let seen: string | undefined;
    const inner: Middleware = async (_ctx, next) => {
      seen = currentReqId();
      await next();
    };
    await compose([withRequestId(), inner])(fakeCtx());
    expect(seen).toBe('test-req-1');
  });

  it('propagates the bound id across a microtask/timer await inside next()', async () => {
    const ctx = fakeCtx({ reqId: 'rid-async' });
    let before: string | undefined;
    let after: string | undefined;
    const inner: Middleware = async (_ctx, next) => {
      before = currentReqId();
      await new Promise((resolve) => setTimeout(resolve, 0));
      after = currentReqId();
      await next();
    };
    await compose([withRequestId(), inner])(ctx);
    expect(before).toBe('rid-async');
    expect(after).toBe('rid-async');
  });

  it('is undefined outside the middleware run', async () => {
    expect(currentReqId()).toBeUndefined();
    await compose([withRequestId(), async (_ctx, next) => next()])(fakeCtx());
    expect(currentReqId()).toBeUndefined();
  });
});
