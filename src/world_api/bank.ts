import type { InvSlot } from '../sim/types';

// ---------------------------------------------------------------------------
// The Bank (the per-character deposit box). A second pooled item store beside
// the carried backpack + bags: capacity is a flat slot budget over one list
// (nothing pins an item to a fixed cell), and the state is per-character,
// serialized inside the character save exactly like inventory/bags. bankInfo
// streams only while standing at a banker NPC (the mailInfo pattern). The base
// 24 slots grow in copper-bought 6-slot blocks (BANK_EXPANSION_PRICES) plus a
// later phase's server-stamped bonus slots.
// ---------------------------------------------------------------------------

export interface BankInfo {
  slots: InvSlot[]; // the pooled bank contents (a boundary clone, never a live sim reference)
  capacity: number; // total slot budget: base + purchased + bonus
  purchasedSlots: number; // copper-bought slots, always a multiple of the 6-slot block
  bonusSlots: number; // server-granted bonus slots (0 until a later phase stamps them)
  // Copper price of the NEXT expansion, null once purchased slots are maxed.
  nextExpansionCost: number | null;
}

export interface IWorldBank {
  // Non-null only while standing at a banker NPC.
  bankInfo: BankInfo | null;
  bankDeposit(slotIndex: number, count?: number): void;
  bankWithdraw(slotIndex: number, count?: number): void;
  bankBuySlots(): void;
}
