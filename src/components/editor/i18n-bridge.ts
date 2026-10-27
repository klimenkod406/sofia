/**
 * Мост для модульных хелперов редактора, которым нужен доступ к функции
 * перевода без вызова useTranslation (правило react-hooks/rules-of-hooks).
 *
 * useTranslation() живёт в компонентах: компонент при каждом рендере
 * сохраняет свою `t` сюда через _registerT. Модульный хелпер (например,
 * reportExportError, который вызывается из .catch) берёт «последнюю
 * зарегистрированную» и переводит через неё.
 *
 * Регистрация — best-effort: если ни один компонент не зарегистрировался,
 * helper использует английский fallback. Текущая `t` параметризована узким
 * TranslationKey, поэтому _registerT принимает структурно совместимый тип.
 */

type TFunction = (key: string, params?: Record<string, string | number>) => string;

let lastT: TFunction | null = null;

export function _registerT(t: ((key: string, params?: unknown) => string) | null): void {
  lastT = t as TFunction | null;
}

export function _translate(key: string): string {
  if (!lastT) return key;
  try {
    return lastT(key);
  } catch {
    return key;
  }
}
