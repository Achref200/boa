import { formatMoney, compareMoney, type MoneyString } from '@/lib/money';
import { cn } from '@/lib/cn';

/**
 * Prices are rendered from a decimal string, never a float, and always through
 * Intl so the Tunisian dinar keeps its three decimals in every locale.
 * A struck-through comparison price is only shown when it is genuinely higher.
 */
export function Price({
  amount,
  compareAt,
  locale,
  fromLabel,
  className,
  metal = false,
}: {
  amount: MoneyString;
  compareAt?: MoneyString | null;
  locale: string;
  fromLabel?: string;
  className?: string;
  metal?: boolean;
}) {
  const showCompare = compareAt !== null && compareAt !== undefined && compareMoney(compareAt, amount) > 0;

  return (
    <p className={cn('flex items-baseline gap-2', className)}>
      {fromLabel ? (
        <span className="text-[11px] uppercase tracking-[0.12em] text-[var(--surface-muted)]">{fromLabel}</span>
      ) : null}
      <span className={cn('tabular-nums', metal && 'price-metal')}>{formatMoney(amount, locale)}</span>
      {showCompare ? (
        <span className="text-xs text-[var(--surface-muted)] line-through tabular-nums">
          {formatMoney(compareAt, locale)}
        </span>
      ) : null}
    </p>
  );
}
