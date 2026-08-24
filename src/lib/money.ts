/**
 * Money in this codebase is always a string of millimes-precision decimal, or
 * a bigint of millimes internally — never a JavaScript number. The Tunisian
 * dinar has three decimal places, and 0.1 + 0.2 is still not 0.3.
 *
 * Conversion happens here and nowhere else.
 */
export const CURRENCY = 'TND' as const;
const SCALE = 1000n; // millimes per dinar

export type MoneyString = string; // e.g. "129.500"

export function toMillimes(value: MoneyString | number): bigint {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Money value must be finite');
    return BigInt(Math.round(value * 1000));
  }
  const trimmed = value.trim();
  if (!/^-?\d+(\.\d{1,3})?$/.test(trimmed)) {
    throw new TypeError(`Not a valid money string: ${value}`);
  }
  const negative = trimmed.startsWith('-');
  const [whole = '0', fraction = ''] = trimmed.replace('-', '').split('.');
  const millimes = BigInt(whole) * SCALE + BigInt(fraction.padEnd(3, '0'));
  return negative ? -millimes : millimes;
}

export function fromMillimes(millimes: bigint): MoneyString {
  const negative = millimes < 0n;
  const abs = negative ? -millimes : millimes;
  const whole = abs / SCALE;
  const fraction = (abs % SCALE).toString().padStart(3, '0');
  return `${negative ? '-' : ''}${whole}.${fraction}`;
}

export const addMoney = (...values: MoneyString[]): MoneyString =>
  fromMillimes(values.reduce((sum, v) => sum + toMillimes(v), 0n));

export const subtractMoney = (a: MoneyString, b: MoneyString): MoneyString =>
  fromMillimes(toMillimes(a) - toMillimes(b));

export const multiplyMoney = (value: MoneyString, quantity: number): MoneyString => {
  if (!Number.isInteger(quantity)) throw new TypeError('Quantity must be an integer');
  return fromMillimes(toMillimes(value) * BigInt(quantity));
};

/** Percentage of an amount, rounded half-up to the millime. */
export const percentOfMoney = (value: MoneyString, percent: number): MoneyString => {
  const basis = toMillimes(value) * BigInt(Math.round(percent * 100));
  const rounded = (basis + 5000n) / 10000n; // /10000 with half-up rounding
  return fromMillimes(rounded);
};

export const compareMoney = (a: MoneyString, b: MoneyString): number => {
  const left = toMillimes(a);
  const right = toMillimes(b);
  return left === right ? 0 : left < right ? -1 : 1;
};

export const isZeroMoney = (value: MoneyString): boolean => toMillimes(value) === 0n;
export const maxMoney = (a: MoneyString, b: MoneyString): MoneyString =>
  compareMoney(a, b) >= 0 ? a : b;

const FORMATTERS: Record<string, Intl.NumberFormat> = {};

/**
 * Display formatting. Tunisian retail writes prices with three decimals
 * ("129,500 DT"); Intl with the TND currency does exactly that, so we don't
 * hand-roll it.
 */
export function formatMoney(value: MoneyString, locale: string): string {
  const key = locale;
  FORMATTERS[key] ??= new Intl.NumberFormat(
    locale === 'ar' ? 'ar-TN' : locale === 'en' ? 'en-TN' : 'fr-TN',
    { style: 'currency', currency: CURRENCY, minimumFractionDigits: 3, maximumFractionDigits: 3 },
  );
  return FORMATTERS[key]!.format(Number(value));
}
