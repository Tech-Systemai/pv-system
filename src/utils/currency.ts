export const CURRENCIES = {
  USD: { symbol: '$',  code: 'USD', name: 'US Dollar' },
  PHP: { symbol: '₱', code: 'PHP', name: 'Philippine Peso' },
  EGP: { symbol: 'E£', code: 'EGP', name: 'Egyptian Pound' },
  AED: { symbol: 'AED ', code: 'AED', name: 'UAE Dirham' },
  SAR: { symbol: 'SAR ', code: 'SAR', name: 'Saudi Riyal' },
} as const;

export type CurrencyCode = keyof typeof CURRENCIES;

export function fmt(amount: number, currency: string = 'USD'): string {
  const cur = CURRENCIES[currency as CurrencyCode] ?? CURRENCIES.USD;
  return `${cur.symbol}${amount.toLocaleString()}`;
}

/** Next `count` bi-weekly pay dates starting from or after today, anchored on firstPayDate. */
export function getPayDates(firstPayDate: string | null | undefined, count = 4): Date[] {
  if (!firstPayDate) return [];
  const anchor = new Date(firstPayDate);
  anchor.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffMs = today.getTime() - anchor.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  // How many full 14-day cycles have elapsed?  Start from previous cycle so we catch "today is a pay day"
  const cyclesElapsed = Math.max(0, Math.floor(diffDays / 14));
  const dates: Date[] = [];
  let i = cyclesElapsed;
  while (dates.length < count) {
    const d = new Date(anchor);
    d.setDate(anchor.getDate() + i * 14);
    if (d >= today) dates.push(d);
    i++;
  }
  return dates;
}

export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function fmtDateShort(d: Date | string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
