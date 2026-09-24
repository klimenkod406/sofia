'use client';

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '@/stores/settings';
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
import { AiModelsSettings } from '@/components/settings/ai-models-settings';
import { LanguageSelector } from '@/components/settings/language-selector';
import { useTranslation } from '@/lib/i18n';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Sun,
  Moon,
  Type,
  Palette,
  Bot,
  LayoutGrid,
  Shield,
  Download,
  Upload,
  MonitorSmartphone,
  RotateCcw,
  Trash2,
} from 'lucide-react';

export function SettingsPage() {
  const navigate = useNavigate();
  const { theme, font, editor, setTheme, setFont, setEditor, resetToDefaults } = useSettings();
  const [activeTab, setActiveTab] = useState('appearance');
  const { t } = useTranslation();

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
          <TabsTrigger value="ai">
            <Bot className="w-4 h-4 mr-2" />
            {t('aiModels')}
          </TabsTrigger>
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

        {/* Editor Tab */}
        <TabsContent value="editor" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('editingExperience')}</CardTitle>
              <CardDescription>{t('editingExperienceDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>{t('editorMode')}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t('editorModeDesc')}
                  </p>
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
        </TabsContent>

        {/* AI Tab */}
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
                    <p className="text-sm text-muted-foreground">
                      {t('defaultReminderDesc')}
                    </p>
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
                    <p className="text-sm text-muted-foreground">
                      {t('weekStartsOnDesc')}
                    </p>
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
                    <p className="text-sm text-muted-foreground">
                      {t('showWeekendsDesc')}
                    </p>
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
                  <p className="text-sm text-muted-foreground">
                    {t('autoBackupDesc')}
                  </p>
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
                <p className="text-sm text-muted-foreground">
                  {t('hardwareAccelerationDesc')}
                </p>
              </div>
              <Switch checked={true} onCheckedChange={() => {}} />

              <div className="space-y-2">
                <Label>{t('reduceAnimations')}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('reduceAnimationsDesc')}
                </p>
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
