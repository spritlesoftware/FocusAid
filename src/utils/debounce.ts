// ─── Debounce / cooldown utility ────────────────────────────────
export function createCooldown(ms: number) {
  let lastFiredAt = 0;
  return {
    isAllowed: (): boolean => Date.now() - lastFiredAt >= ms,
    reset: (): void => { lastFiredAt = Date.now(); },
  };
}
