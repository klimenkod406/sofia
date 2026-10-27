'use client';

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useSettings,
  TOOLBAR_ITEMS,
  type ToolbarItemId,
  DEFAULT_TOOLBAR_ITEMS,
} from '@/stores/settings';
// FIXME(AI-FEATURE): AiModelsSettings временно не используется — вкладка
// «ИИ» в настройках скрыта. Вернуть:
//   import { AiModelsSettings } from '@/components/settings/ai-models-settings';
// и снять комментарий с <AiModelsSettings /> ниже.
import { cn } from '@/utils/cn';
import { Button } from '@/components/ui/button';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
// FIXME(AI-FEATURE): AiModelsSettings временно не используется — вкладка
// «ИИ» в настройках скрыта. Вернуть:
//   import { AiModelsSettings } from '@/components/settings/ai-models-settings';
// и снять комментарий с <AiModelsSettings /> ниже.
import { LanguageSelector } from '@/components/settings/language-selector';
import { useTranslation } from '@/lib/i18n';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Sun,
  Moon,
  Type,
  Palette,
  // FIXME(AI-FEATURE): иконка для вкладки «ИИ» временно не нужна.
  // Bot,
  LayoutGrid,
  Shield,
  Download,
  Upload,
  MonitorSmartphone,
  RotateCcw,
  Trash2,
  Check,
  Plus,
  Minus,
} from 'lucide-react';

export function SettingsPage() {
  const navigate = useNavigate();
  const {
    theme,
    font,
    editor,
    toolbarItems,
    setTheme,
    setFont,
    setEditor,
    toggleToolbarItem,
    setToolbarItems,
    resetToDefaults,
  } = useSettings();
  const [activeTab, setActiveTab] = useState('appearance');
  const { t } = useTranslation();

  /** Каталог инструментов тулбара: подписи и группировка для UI настроек. */
  const toolbarCatalog: Array<{
    id: ToolbarItemId;
    label: string;
    group: 'format' | 'headings' | 'lists' | 'script' | 'blocks' | 'media' | 'cleanup';
  }> = [
    // format
    { id: 'bold', label: t('bold').replace(/\s*\(Ctrl\+B\)/, ''), group: 'format' },
    { id: 'italic', label: t('italic').replace(/\s*\(Ctrl\+I\)/, ''), group: 'format' },
    { id: 'strike', label: t('strikethrough'), group: 'format' },
    { id: 'code', label: t('code'), group: 'format' },
    { id: 'highlight', label: t('highlight'), group: 'format' },
    { id: 'textColor', label: t('textColor'), group: 'format' },
    { id: 'alignLeft', label: t('alignLeft'), group: 'format' },
    { id: 'alignCenter', label: t('alignCenter'), group: 'format' },
    { id: 'alignRight', label: t('alignRight'), group: 'format' },
    // headings
    { id: 'h1', label: t('heading1'), group: 'headings' },
    { id: 'h2', label: t('heading2'), group: 'headings' },
    { id: 'h3', label: t('heading3'), group: 'headings' },
    { id: 'paragraph', label: t('paragraph'), group: 'headings' },
    // lists
    { id: 'bulletList', label: t('bulletList'), group: 'lists' },
    { id: 'numberedList', label: t('numberedList'), group: 'lists' },
    { id: 'taskList', label: t('taskList'), group: 'lists' },
    { id: 'indent', label: t('indent'), group: 'lists' },
    { id: 'outdent', label: t('outdent'), group: 'lists' },
    // script
    { id: 'uppercase', label: t('uppercase'), group: 'script' },
    { id: 'lowercase', label: t('lowercase'), group: 'script' },
    // blocks
    { id: 'quote', label: t('quote'), group: 'blocks' },
    { id: 'codeBlock', label: t('codeBlock'), group: 'blocks' },
    { id: 'hr', label: t('horizontalRule'), group: 'blocks' },
    // media
    { id: 'link', label: t('link').replace(/\s*\(Ctrl\+K\)/, ''), group: 'media' },
    { id: 'image', label: t('image'), group: 'media' },
    { id: 'table', label: t('table'), group: 'media' },
    { id: 'tableFloat', label: t('tableFloat'), group: 'media' },
    { id: 'imageSize', label: t('imageSize'), group: 'media' },
    { id: 'imageFloat', label: t('imageFloat'), group: 'media' },
    { id: 'find', label: t('findAndReplace'), group: 'media' },
    // cleanup
    { id: 'undo', label: t('undo').replace(/\s*\(Ctrl\+Z\)/, ''), group: 'cleanup' },
    { id: 'redo', label: t('redo').replace(/\s*\(Ctrl\+Shift\+Z\)/, ''), group: 'cleanup' },
    { id: 'clearFormatting', label: t('clearFormatting'), group: 'cleanup' },
    { id: 'removeLink', label: t('removeLink'), group: 'cleanup' },
    { id: 'export', label: t('saveNow'), group: 'cleanup' },
    { id: 'print', label: t('exportAndPrint'), group: 'cleanup' },
  ];

  const groupsOrder: Array<(typeof toolbarCatalog)[number]['group']> = [
    'format',
    'headings',
    'lists',
    'script',
    'blocks',
    'media',
    'cleanup',
  ];
  const groupTitles: Record<(typeof toolbarCatalog)[number]['group'], string> = {
    format: t('formatGroup'),
    headings: t('headingsGroup'),
    lists: t('listsGroup'),
    script: t('caseGroup'),
    blocks: t('blocksGroup'),
    media: t('mediaGroup'),
    cleanup: t('cleanupGroup'),
  };
  const visibleSet = new Set<ToolbarItemId>(toolbarItems);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <Breadcrumbs
          onBack={() => navigate('/home')}
          parentLabel={t('home')}
          current={t('settings')}
          className="mb-1 justify-start"
        />
        <h1 className="text-3xl font-bold tracking-tight">{t('settingsTitle')}</h1>
        <p className="text-muted-foreground">{t('settingsDesc')}</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="appearance">
            <Palette className="w-4 h-4 mr-2" />
            {t('appearance')}
          </TabsTrigger>
          <TabsTrigger value="editor">
            <Type className="w-4 h-4 mr-2" />
            {t('editor')}
          </TabsTrigger>
          {/* FIXME(AI-FEATURE): вкладка «ИИ» временно скрыта из интерфейса.
        <TabsTrigger value="ai">
          <Bot className="w-4 h-4 mr-2" />
          {t('aiModels')}
        </TabsTrigger>
        */}
          <TabsTrigger value="calendar">
            <LayoutGrid className="w-4 h-4 mr-2" />
            {t('calendarSettings')}
          </TabsTrigger>
          <TabsTrigger value="advanced">
            <Shield className="w-4 h-4 mr-2" />
            {t('advanced')}
          </TabsTrigger>
        </TabsList>
        {/* Appearance Tab */}
        <TabsContent value="appearance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('language')}</CardTitle>
              <CardDescription>{t('languageDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <LanguageSelector />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t('theme')}</CardTitle>
              <CardDescription>{t('themeDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                {[
                  { value: 'light', label: t('light'), icon: Sun, desc: t('lightDesc') },
                  { value: 'dark', label: t('dark'), icon: Moon, desc: t('darkDesc') },
                  {
                    value: 'system',
                    label: t('system'),
                    icon: MonitorSmartphone,
                    desc: t('systemDesc'),
                  },
                ].map(({ value, label, icon: Icon, desc }) => (
                  <button
                    key={value}
                    onClick={() => setTheme(value as 'light' | 'dark' | 'system')}
                    className={cn(
                      'relative p-4 rounded-xl border-2 transition-all',
                      theme === value
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-5 h-5" />
                      <div>
                        <div className="font-medium">{label}</div>
                        <div className="text-sm text-muted-foreground">{desc}</div>
                      </div>
                    </div>
                    {theme === value && (
                      <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('fontSettings')}</CardTitle>
              <CardDescription>{t('fontSettingsDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fontFamily">{t('fontFamily')}</Label>
                <Select value={font.family} onValueChange={v => setFont({ family: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      { value: 'Onest', hint: t('textAndUi') },
                      { value: 'Manrope', hint: t('headings') },
                      { value: 'JetBrains Mono', hint: t('code') },
                    ].map(f => (
                      <SelectItem key={f.value} value={f.value}>
                        <span style={{ fontFamily: f.value }}>
                          {f.value} — {f.hint}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="fontSize">{t('fontSize', { size: font.size })}</Label>
                <Slider
                  value={[font.size]}
                  onValueChange={([v]) => setFont({ size: v })}
                  min={10}
                  max={24}
                  step={1}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lineHeight">{t('lineHeight', { height: font.lineHeight })}</Label>
                <Slider
                  value={[font.lineHeight]}
                  onValueChange={([v]) => setFont({ lineHeight: v })}
                  min={1}
                  max={3}
                  step={0.1}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        /* Editor Tab */
        <TabsContent value="editor" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('fontSettings')}</CardTitle>
              <CardDescription>{t('fontSettingsDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fontFamily">{t('fontFamily')}</Label>
                <Select value={font.family} onValueChange={v => setFont({ family: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      // Шрифты с кириллицей, загружаются через Google Fonts (index.html).
                      { value: 'Onest', hint: t('textAndUi') },
                      { value: 'Manrope', hint: t('headings') },
                      { value: 'JetBrains Mono', hint: t('code') },
                      { value: 'Inter', hint: t('textAndUi') },
                      { value: 'IBM Plex Sans', hint: t('textAndUi') },
                      { value: 'IBM Plex Serif', hint: t('headings') },
                      { value: 'Lora', hint: t('headings') },
                      { value: 'PT Serif', hint: t('headings') },
                    ].map(f => (
                      <SelectItem key={f.value} value={f.value}>
                        <span style={{ fontFamily: f.value }}>
                          {f.value} — {f.hint}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="fontSize">{t('fontSize', { size: font.size })}</Label>
                <Slider
                  value={[font.size]}
                  onValueChange={([v]) => setFont({ size: v })}
                  min={10}
                  max={24}
                  step={1}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lineHeight">{t('lineHeight', { height: font.lineHeight })}</Label>
                <Slider
                  value={[font.lineHeight]}
                  onValueChange={([v]) => setFont({ lineHeight: v })}
                  min={1}
                  max={3}
                  step={0.1}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('textWeight')}</Label>
                <Select
                  value={editor.textWeight}
                  onValueChange={v =>
                    setEditor({ textWeight: v as 'regular' | 'medium' | 'semibold' })
                  }
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="regular">{t('textWeightRegular')}</SelectItem>
                    <SelectItem value="medium">{t('textWeightMedium')}</SelectItem>
                    <SelectItem value="semibold">{t('textWeightSemibold')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('sheetSettings')}</CardTitle>
              <CardDescription>{t('sheetSettingsDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t('sheetWidth')}</Label>
                <Select
                  value={editor.sheetWidth}
                  onValueChange={v => setEditor({ sheetWidth: v as 'narrow' | 'normal' | 'wide' })}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="narrow">{t('sheetWidthNarrow')}</SelectItem>
                    <SelectItem value="normal">{t('sheetWidthNormal')}</SelectItem>
                    <SelectItem value="wide">{t('sheetWidthWide')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('paragraphSpacing', { rem: editor.paragraphSpacing.toFixed(1) })}</Label>
                <Slider
                  value={[editor.paragraphSpacing]}
                  onValueChange={([v]) => setEditor({ paragraphSpacing: v })}
                  min={0}
                  max={1.5}
                  step={0.1}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('editingExperience')}</CardTitle>
              <CardDescription>{t('editingExperienceDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>{t('editorMode')}</Label>
                  <p className="text-sm text-muted-foreground">{t('editorModeDesc')}</p>
                </div>
                <Select
                  value={editor.mode}
                  onValueChange={v => setEditor({ mode: v as 'wysiwyg' | 'markdown' })}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="wysiwyg">{t('wysiwyg')}</SelectItem>
                    <SelectItem value="markdown">{t('markdown')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="space-y-4">
                {[
                  {
                    key: 'autoSave',
                    label: t('autoSave'),
                    desc: t('autoSaveDesc'),
                  },
                  {
                    key: 'spellCheck',
                    label: t('spellCheck'),
                    desc: t('spellCheckDesc'),
                  },
                  {
                    key: 'showLineNumbers',
                    label: t('lineNumbers'),
                    desc: t('lineNumbersDesc'),
                  },
                  {
                    key: 'vimMode',
                    label: t('vimMode'),
                    desc: t('vimModeDesc'),
                  },
                ].map(({ key, label, desc }) => (
                  <div key={key} className="flex items-center justify-between">
                    <div>
                      <Label>{label}</Label>
                      <p className="text-sm text-muted-foreground">{desc}</p>
                    </div>
                    <Switch
                      checked={editor[key as keyof typeof editor] as boolean}
                      onCheckedChange={v => setEditor({ [key]: v })}
                    />
                  </div>
                ))}
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="autoSaveInterval">
                  {t('autoSaveInterval', { ms: editor.autoSaveInterval })}
                </Label>
                <Slider
                  value={[editor.autoSaveInterval]}
                  onValueChange={([v]) => setEditor({ autoSaveInterval: v })}
                  min={500}
                  max={10000}
                  step={500}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('toolbarMenu')}</CardTitle>
              <CardDescription>{t('toolbarMenuDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {t('toolbarMenuVisible', {
                    shown: toolbarItems.length,
                    total: TOOLBAR_ITEMS.length,
                  })}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setToolbarItems([...DEFAULT_TOOLBAR_ITEMS])}
                    className="gap-1.5"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    {t('toolbarReset')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setToolbarItems([...TOOLBAR_ITEMS])}
                    className="gap-1.5"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {t('toolbarShowAll')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setToolbarItems([])}
                    className="gap-1.5"
                  >
                    <Minus className="h-3.5 w-3.5" />
                    {t('toolbarHideAll')}
                  </Button>
                </div>
              </div>
              <div className="space-y-4">
                {groupsOrder.map(group => {
                  const items = toolbarCatalog.filter(it => it.group === group);
                  return (
                    <div key={group}>
                      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {groupTitles[group]}
                      </h4>
                      <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
                        {items.map(it => {
                          const on = visibleSet.has(it.id);
                          return (
                            <button
                              key={it.id}
                              type="button"
                              onClick={() => toggleToolbarItem(it.id)}
                              className={cn(
                                'flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                                on
                                  ? 'border-primary/40 bg-primary/5 text-foreground'
                                  : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
                              )}
                              aria-pressed={on}
                            >
                              <span className="truncate">{it.label}</span>
                              {on ? (
                                <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                              ) : (
                                <span className="h-3.5 w-3.5 shrink-0 rounded border border-border" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        {/* FIXME(AI-FEATURE): вкладка «ИИ» временно скрыта из интерфейса.
        <TabsContent value="ai" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('aiModelsTitle')}</CardTitle>
              <CardDescription>{t('aiModelsDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <AiModelsSettings />
            </CardContent>
          </Card>
        </TabsContent>
        */}
        {/* Calendar Tab */}
        <TabsContent value="calendar" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('calendarSettingsTitle')}</CardTitle>
              <CardDescription>{t('calendarSettingsDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>{t('defaultReminder')}</Label>
                    <p className="text-sm text-muted-foreground">{t('defaultReminderDesc')}</p>
                  </div>
                  <Select defaultValue="15" onValueChange={() => {}}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder={t('minutes', { n: 15 })} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">{t('atTimeOfEvent')}</SelectItem>
                      <SelectItem value="5">{t('minutes', { n: 5 })}</SelectItem>
                      <SelectItem value="15">{t('minutes', { n: 15 })}</SelectItem>
                      <SelectItem value="30">{t('minutes', { n: 30 })}</SelectItem>
                      <SelectItem value="60">{t('hours', { n: 1 })}</SelectItem>
                      <SelectItem value="1440">{t('daysBefore', { n: 1 })}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>{t('weekStartsOn')}</Label>
                    <p className="text-sm text-muted-foreground">{t('weekStartsOnDesc')}</p>
                  </div>
                  <Select defaultValue="0" onValueChange={() => {}}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder={t('sunday')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">{t('sunday')}</SelectItem>
                      <SelectItem value="1">{t('monday')}</SelectItem>
                      <SelectItem value="6">{t('saturday')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>{t('showWeekends')}</Label>
                    <p className="text-sm text-muted-foreground">{t('showWeekendsDesc')}</p>
                  </div>
                  <Switch checked={true} onCheckedChange={() => {}} />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>{t('defaultEventDuration')}</Label>
                    <p className="text-sm text-muted-foreground">{t('defaultEventDurationDesc')}</p>
                  </div>
                  <Select defaultValue="60" onValueChange={() => {}}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder={t('minutes', { n: 60 })} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">{t('minutes', { n: 15 })}</SelectItem>
                      <SelectItem value="30">{t('minutes', { n: 30 })}</SelectItem>
                      <SelectItem value="60">{t('hours', { n: 1 })}</SelectItem>
                      <SelectItem value="90">{t('hours', { n: 1.5 })}</SelectItem>
                      <SelectItem value="120">{t('hours', { n: 2 })}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        {/* Advanced Tab */}
        <TabsContent value="advanced" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('dataManagement')}</CardTitle>
              <CardDescription>{t('dataManagementDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>{t('autoBackup')}</Label>
                  <p className="text-sm text-muted-foreground">{t('autoBackupDesc')}</p>
                </div>
                <Switch checked={true} onCheckedChange={() => {}} />
              </div>

              <Button variant="outline" className="w-full justify-start gap-2">
                <Download className="w-4 h-4" />
                {t('exportAllData')}
              </Button>

              <Button variant="outline" className="w-full justify-start gap-2">
                <Upload className="w-4 h-4" />
                {t('importData')}
              </Button>

              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={resetToDefaults}
              >
                <RotateCcw className="w-4 h-4" />
                {t('resetAllSettings')}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('performance')}</CardTitle>
              <CardDescription>{t('performanceDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t('hardwareAcceleration')}</Label>
                <p className="text-sm text-muted-foreground">{t('hardwareAccelerationDesc')}</p>
              </div>
              <Switch checked={true} onCheckedChange={() => {}} />

              <div className="space-y-2">
                <Label>{t('reduceAnimations')}</Label>
                <p className="text-sm text-muted-foreground">{t('reduceAnimationsDesc')}</p>
              </div>
              <Switch checked={false} onCheckedChange={() => {}} />
            </CardContent>
          </Card>

          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="text-destructive">{t('dangerZone')}</CardTitle>
              <CardDescription>{t('dangerZoneDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="destructive" className="w-full justify-start gap-2">
                <Trash2 className="w-4 h-4" />
                {t('deleteAllData')}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
