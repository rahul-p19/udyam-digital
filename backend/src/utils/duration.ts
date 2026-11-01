const DURATION_UNITS: Record<string, number> = {
  s: 1,
  m: 60,
  h: 60 * 60,
  d: 24 * 60 * 60,
  w: 7 * 24 * 60 * 60,
};

export const parseDurationToSeconds = (value: string): number => {
  const match = /^(\d+)\s*([smhdw])?$/i.exec(value.trim());
  if (!match) {
    throw new Error(`Invalid duration value: "${value}"`);
  }

  const amount = Number(match[1]);
  const unit = (match[2] ?? "s").toLowerCase();
  return amount * DURATION_UNITS[unit];
};
