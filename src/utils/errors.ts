import type { Language } from '../i18n/translations';

export function isDateLockedError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.message === 'DATE_LOCKED' || error.message.includes('DATE_LOCKED');
  }

  return typeof error === 'string' && error.includes('DATE_LOCKED');
}

export function getDateLockedMessage(language: Language): string {
  if (language === 'vi') {
    return 'Ngày này đã chốt hoàn tất. Không thể thay đổi dữ liệu.';
  }

  if (language === 'ja') {
    return 'この日付は締め切り済みです。データを変更できません。';
  }

  return 'This date is locked/finalized. Data cannot be changed.';
}

export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
