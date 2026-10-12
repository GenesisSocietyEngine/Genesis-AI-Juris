import type { StudioNode } from './types';

type Statement = { factStatus?: StudioNode['factStatus'] };

/** Recorded status describes the author's statement, never independent verification. */
export function reportStatementStatus(item: Statement, language: 'en' | 'ru'): string {
  if (!item.factStatus) return '';
  if (item.factStatus === 'assumed') return language === 'en'
    ? 'Assumed statement — requires verification'
    : 'Допущение — требует проверки';
  return language === 'en'
    ? 'Asserted statement — independent verification not recorded'
    : 'Утверждение — независимая проверка не зафиксирована';
}

export function reportStatementDetail(item: Statement & { detail: string }, language: 'en' | 'ru'): string {
  const status = reportStatementStatus(item, language);
  return status ? status + '\n' + item.detail : item.detail;
}
