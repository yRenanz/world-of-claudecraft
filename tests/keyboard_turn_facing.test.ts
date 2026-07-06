import { describe, expect, it } from 'vitest';
import {
  type KeyboardTurnArgs,
  newKeyboardTurnState,
  stepKeyboardTurnFacing,
} from '../src/game/keyboard_turn_facing';
import { TURN_SPEED } from '../src/sim/types';

const FRAME_60 = 1 / 60;

const args = (over: Partial<KeyboardTurnArgs> = {}): KeyboardTurnArgs => ({
  turnLeft: false,
  turnRight: false,
  turnAllowed: true,
  sentFacing: null,
  serverFacing: 0,
  frameDt: FRAME_60,
  ...over,
});

describe('stepKeyboardTurnFacing', () => {
  it('integrates a right turn as a DECREASING facing at TURN_SPEED', () => {
    const st = newKeyboardTurnState();
    const f = stepKeyboardTurnFacing(st, args({ turnRight: true, serverFacing: 1.0 }));
    expect(f).toBeCloseTo(1.0 - TURN_SPEED * FRAME_60, 6);
  });

  it('integrates a left turn as an INCREASING facing at TURN_SPEED', () => {
    const st = newKeyboardTurnState();
    const f = stepKeyboardTurnFacing(st, args({ turnLeft: true, serverFacing: -0.5 }));
    expect(f).toBeCloseTo(-0.5 + TURN_SPEED * FRAME_60, 6);
  });

  it('seeds from the server facing on engage (no first-frame jump)', () => {
    const st = newKeyboardTurnState();
    const f = stepKeyboardTurnFacing(st, args({ turnLeft: true, serverFacing: 2.4 }));
    // one frame of turning away from exactly where the model was displayed
    expect(Math.abs((f as number) - 2.4)).toBeLessThanOrEqual(TURN_SPEED * FRAME_60 + 1e-9);
  });

  it('ignores the stale server facing while a key is held (no mid-turn drag-back)', () => {
    const st = newKeyboardTurnState();
    let f = stepKeyboardTurnFacing(st, args({ turnLeft: true, serverFacing: 0 }));
    // server facing lags a round trip behind; local integration must not chase it
    f = stepKeyboardTurnFacing(st, args({ turnLeft: true, serverFacing: -1.0 }));
    expect(f).toBeCloseTo(2 * TURN_SPEED * FRAME_60, 6);
  });

  it('a non-null sentFacing (mouselook / click-move) clears the state and yields', () => {
    const st = newKeyboardTurnState();
    stepKeyboardTurnFacing(st, args({ turnLeft: true }));
    const f = stepKeyboardTurnFacing(st, args({ turnLeft: true, sentFacing: 1.2 }));
    expect(f).toBeNull();
    expect(st.facing).toBeNull();
  });

  it('NEVER rewinds toward the lagging server facing on release (the nausea bug)', () => {
    // Hold left for half a second, then release. The server facing is still a
    // round trip behind and converging toward us; the display must HOLD, not
    // step backwards at TURN_SPEED and then forward again.
    const st = newKeyboardTurnState();
    let serverFacing = 0;
    for (let i = 0; i < 30; i++) {
      stepKeyboardTurnFacing(st, args({ turnLeft: true, serverFacing }));
    }
    const held = st.facing as number;
    // a realistic echo: the server facing is ~150ms (9 frames) of turning behind
    serverFacing = held - 9 * TURN_SPEED * FRAME_60;
    let f: number | null = held;
    let minSeen = held;
    let frames = 0;
    while (f !== null && frames < 60) {
      serverFacing = Math.min(held, serverFacing + TURN_SPEED * FRAME_60);
      f = stepKeyboardTurnFacing(st, args({ serverFacing }));
      if (f !== null) minSeen = Math.min(minSeen, f);
      frames++;
    }
    expect(minSeen).toBeGreaterThanOrEqual(held - 1e-9); // no backward motion at all
    expect(frames).toBeLessThan(30); // handed off as soon as the server caught up
    expect(st.facing).toBeNull();
  });

  it('holds through a server overshoot instead of riding it out and back', () => {
    // Between the key release and the latch landing, the server may keep
    // integrating the in-flight held flags PAST the held heading, then the
    // latch snaps it back onto it. The display must hold still through the
    // whole excursion (this was the residual re-aim after every turn).
    const st = newKeyboardTurnState();
    for (let i = 0; i < 20; i++) {
      stepKeyboardTurnFacing(st, args({ turnLeft: true, serverFacing: 0 }));
    }
    const held = st.facing as number;
    // overshoot beyond eps, linger, then settle back to the latched heading
    const excursion = [0.08, 0.12, 0.12, 0.08, 0.0];
    for (const off of excursion.slice(0, 4)) {
      const f = stepKeyboardTurnFacing(st, args({ serverFacing: held + off }));
      expect(f).toBeCloseTo(held, 9); // held perfectly still, no ride-along
    }
    const f = stepKeyboardTurnFacing(st, args({ serverFacing: held }));
    expect(f).toBeCloseTo(held, 6); // bridged onto the settled server facing
    expect(st.facing).toBeNull(); // handed off at eps-arrival
  });

  it('holds a persistent residual through the grace window, then glides it out gently', () => {
    const st = newKeyboardTurnState();
    for (let i = 0; i < 30; i++) {
      stepKeyboardTurnFacing(st, args({ turnLeft: true, serverFacing: 0 }));
    }
    const held = st.facing as number;
    // the server never catches up (stun landed mid-turn): facing stays behind
    const serverFacing = held - 0.15;
    // during the grace window the display holds perfectly still
    for (let i = 0; i < 18; i++) {
      // 300ms < grace
      expect(stepKeyboardTurnFacing(st, args({ serverFacing }))).toBeCloseTo(held, 9);
    }
    // past the grace window it glides back, far slower than TURN_SPEED
    let prev = held;
    let f: number | null = held;
    let frames = 0;
    while (f !== null && frames < 600) {
      f = stepKeyboardTurnFacing(st, args({ serverFacing }));
      if (f !== null) {
        const step = Math.abs(f - prev);
        expect(step).toBeLessThan((TURN_SPEED / 2) * FRAME_60); // gentle, not a snap
        prev = f;
      }
      frames++;
    }
    expect(st.facing).toBeNull(); // eventually converged and handed off
  });

  it('holds instead of integrating while turning is not allowed (stun family)', () => {
    const st = newKeyboardTurnState();
    stepKeyboardTurnFacing(st, args({ turnLeft: true, serverFacing: 0 }));
    const engaged = st.facing as number;
    const f = stepKeyboardTurnFacing(
      st,
      args({ turnLeft: true, turnAllowed: false, serverFacing: 0 }),
    );
    // no further integration, and no immediate rewind either (grace window)
    expect(f).toBeCloseTo(engaged, 9);
  });

  it('clamps an over-long frame so a hitch cannot over-rotate', () => {
    const st = newKeyboardTurnState();
    const f = stepKeyboardTurnFacing(st, args({ turnLeft: true, serverFacing: 0, frameDt: 0.5 }));
    expect(Math.abs(f as number)).toBeLessThanOrEqual(TURN_SPEED * 0.1 + 1e-9);
  });

  it('both keys held stays engaged with net-zero rotation', () => {
    const st = newKeyboardTurnState();
    const f = stepKeyboardTurnFacing(
      st,
      args({ turnLeft: true, turnRight: true, serverFacing: 0.8 }),
    );
    expect(f).toBeCloseTo(0.8, 6);
    expect(st.facing).not.toBeNull();
  });

  it('returns null and stays inactive when idle', () => {
    const st = newKeyboardTurnState();
    expect(stepKeyboardTurnFacing(st, args({ serverFacing: 1.0 }))).toBeNull();
    expect(st.facing).toBeNull();
  });

  it('wraps across +/-PI while integrating', () => {
    const st = newKeyboardTurnState();
    const f = stepKeyboardTurnFacing(
      st,
      args({ turnLeft: true, serverFacing: Math.PI - 0.01 }),
    ) as number;
    expect(f).toBeLessThan(Math.PI + 1e-9);
    expect(Math.abs(f)).toBeLessThanOrEqual(Math.PI);
  });
});
