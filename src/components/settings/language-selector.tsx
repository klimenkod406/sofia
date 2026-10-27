'use client';

import { useI18n, languages, type Language } from '@/stores/i18n';
import { useTranslation } from '@/lib/i18n';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function LanguageSelector() {
  const { language, setLanguage } = useI18n();
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-between">
      <div className="space-y-0.5">
        <div className="text-sm font-medium">{t('language')}</div>
        <div className="text-xs text-muted-foreground">{t('languageDesc')}</div>
      </div>
      <Select value={language} onValueChange={value => setLanguage(value as Language)}>
        <SelectTrigger className="w-[180px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {languages.map(lang => (
            <SelectItem key={lang.value} value={lang.value}>
              <span className="mr-2">{lang.flag}</span>
              {lang.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
