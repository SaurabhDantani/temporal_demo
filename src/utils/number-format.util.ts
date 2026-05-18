export function parseNumber(value: string | number | undefined | null): number {
  if (!value) return 0;

  if (typeof value === 'number') {
    return value;
  }

  return Number(value.replace(/,/g, '').trim());
}
