'use client';

import { useState } from 'react';
import { useSettings } from '@/stores/settings';
import { cn } from '@/utils/cn';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  RotateCcw,
  Trash2,
} from 'lucide-react';

export function SettingsPage() {
  const { theme, font, editor, ai, setTheme, setFont, setEditor, setAI, resetToDefaults } =
    useSettings();
  const [activeTab, setActiveTab] = useState('appearance');

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Customize Σόφια to match your workflow</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="appearance">
            <Palette className="w-4 h-4 mr-2" />
            Appearance
          </TabsTrigger>
          <TabsTrigger value="editor">
            <Type className="w-4 h-4 mr-2" />
            Editor
          </TabsTrigger>
          <TabsTrigger value="ai">
            <Bot className="w-4 h-4 mr-2" />
            AI Models
          </TabsTrigger>
          <TabsTrigger value="calendar">
            <LayoutGrid className="w-4 h-4 mr-2" />
            Calendar
          </TabsTrigger>
          <TabsTrigger value="advanced">
            <Shield className="w-4 h-4 mr-2" />
            Advanced
          </TabsTrigger>
        </TabsList>

        {/* Appearance Tab */}
        <TabsContent value="appearance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Theme</CardTitle>
              <CardDescription>Choose your preferred color scheme</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { value: 'light', label: 'Light', icon: Sun, desc: 'Warm pastel day' },
                  { value: 'dark', label: 'Dark', icon: Moon, desc: 'Warm pastel night' },
                ].map(({ value, label, icon: Icon, desc }) => (
                  <button
                    key={value}
                    onClick={() => setTheme(value as 'light' | 'dark')}
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
              <CardTitle>Font Settings</CardTitle>
              <CardDescription>Customize the editor font</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fontFamily">Font Family</Label>
                <Select value={font.family} onValueChange={v => setFont({ family: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      { value: 'Onest', hint: 'Текст и интерфейс' },
                      { value: 'Manrope', hint: 'Заголовки' },
                      { value: 'JetBrains Mono', hint: 'Код' },
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
                <Label htmlFor="fontSize">Font Size: {font.size}px</Label>
                <Slider
                  value={[font.size]}
                  onValueChange={([v]) => setFont({ size: v })}
                  min={10}
                  max={24}
                  step={1}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lineHeight">Line Height: {font.lineHeight}</Label>
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
              <CardTitle>Editing Experience</CardTitle>
              <CardDescription>Configure how you write and edit notes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Editor Mode</Label>
                  <p className="text-sm text-muted-foreground">
                    Choose between WYSIWYG and Markdown editing
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
                    <SelectItem value="wysiwyg">WYSIWYG (Rich Text)</SelectItem>
                    <SelectItem value="markdown">Markdown Source</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="space-y-4">
                {[
                  {
                    key: 'autoSave',
                    label: 'Auto-save',
                    desc: 'Automatically save changes as you type',
                  },
                  {
                    key: 'spellCheck',
                    label: 'Spell Check',
                    desc: 'Enable browser spell checking',
                  },
                  {
                    key: 'showLineNumbers',
                    label: 'Line Numbers',
                    desc: 'Show line numbers in markdown mode',
                  },
                  {
                    key: 'vimMode',
                    label: 'Vim Keybindings',
                    desc: 'Enable vim-style keyboard shortcuts',
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
                  Auto-save Interval: {editor.autoSaveInterval}ms
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
              <CardTitle>AI Models</CardTitle>
              <CardDescription>Configure AI models for transcription and analysis</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                {[
                  {
                    key: 'transcriptionLanguage',
                    label: 'Transcription Language',
                    options: [
                      { value: 'auto', label: 'Auto-detect' },
                      { value: 'zh', label: 'Chinese (中文)' },
                      { value: 'en', label: 'English' },
                      { value: 'ja', label: 'Japanese (日本語)' },
                      { value: 'ko', label: 'Korean (한국어)' },
                    ],
                  },
                  {
                    key: 'transcriptionModel',
                    label: 'Transcription Model',
                    options: [
                      { value: 'funasr', label: 'FunASR (Local)' },
                      { value: 'whisper', label: 'Whisper (Local)' },
                      { value: 'openai', label: 'OpenAI Whisper API' },
                    ],
                  },
                  {
                    key: 'analysisModel',
                    label: 'Text Analysis Model',
                    options: [
                      { value: 'local', label: 'Local LLM (llama.cpp)' },
                      { value: 'openai', label: 'OpenAI GPT-4o Mini' },
                      { value: 'anthropic', label: 'Anthropic Claude' },
                    ],
                  },
                  {
                    key: 'apiProvider',
                    label: 'API Provider',
                    options: [
                      { value: 'openai', label: 'OpenAI' },
                      { value: 'anthropic', label: 'Anthropic' },
                      { value: 'custom', label: 'Custom Endpoint' },
                    ],
                  },
                ].map(({ key, label, options }) => (
                  <div key={key} className="space-y-2">
                    <Label>{label}</Label>
                    <Select
                      value={ai[key as keyof typeof ai]}
                      onValueChange={v => setAI({ [key]: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {options.map(o => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>API Keys</CardTitle>
              <CardDescription>Add your API keys for cloud AI services</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>OpenAI API Key</Label>
                  <Input type="password" placeholder="sk-..." />
                  <p className="text-sm text-muted-foreground">
                    Stored securely in system keychain
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Anthropic API Key</Label>
                  <Input type="password" placeholder="sk-ant-..." />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Calendar Tab */}
        <TabsContent value="calendar" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Calendar Settings</CardTitle>
              <CardDescription>Configure calendar behavior and notifications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Default Reminder</Label>
                    <p className="text-sm text-muted-foreground">
                      Set default reminder time for new events
                    </p>
                  </div>
                  <Select defaultValue="15" onValueChange={() => {}}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="15 minutes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">At time of event</SelectItem>
                      <SelectItem value="5">5 minutes</SelectItem>
                      <SelectItem value="15">15 minutes</SelectItem>
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="60">1 hour</SelectItem>
                      <SelectItem value="1440">1 day</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Week Starts On</Label>
                    <p className="text-sm text-muted-foreground">
                      Choose the first day of the week
                    </p>
                  </div>
                  <Select defaultValue="0" onValueChange={() => {}}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Sunday" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Sunday</SelectItem>
                      <SelectItem value="1">Monday</SelectItem>
                      <SelectItem value="6">Saturday</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Show Weekends</Label>
                    <p className="text-sm text-muted-foreground">
                      Display Saturday and Sunday in week view
                    </p>
                  </div>
                  <Switch checked={true} onCheckedChange={() => {}} />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Default Event Duration</Label>
                    <p className="text-sm text-muted-foreground">Default length for new events</p>
                  </div>
                  <Select defaultValue="60" onValueChange={() => {}}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="60 minutes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15 minutes</SelectItem>
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="60">1 hour</SelectItem>
                      <SelectItem value="90">1.5 hours</SelectItem>
                      <SelectItem value="120">2 hours</SelectItem>
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
              <CardTitle>Data Management</CardTitle>
              <CardDescription>Backup, export, and manage your data</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Auto Backup</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically create backups daily
                  </p>
                </div>
                <Switch checked={true} onCheckedChange={() => {}} />
              </div>

              <Button variant="outline" className="w-full justify-start gap-2">
                <Download className="w-4 h-4" />
                Export All Data
              </Button>

              <Button variant="outline" className="w-full justify-start gap-2">
                <Upload className="w-4 h-4" />
                Import Data
              </Button>

              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={resetToDefaults}
              >
                <RotateCcw className="w-4 h-4" />
                Reset All Settings
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Performance</CardTitle>
              <CardDescription>Optimize for your hardware</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Hardware Acceleration</Label>
                <p className="text-sm text-muted-foreground">
                  Use GPU for AI inference when available
                </p>
              </div>
              <Switch checked={true} onCheckedChange={() => {}} />

              <div className="space-y-2">
                <Label>Reduce Animations</Label>
                <p className="text-sm text-muted-foreground">
                  Minimize motion for better performance
                </p>
              </div>
              <Switch checked={false} onCheckedChange={() => {}} />
            </CardContent>
          </Card>

          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
              <CardDescription>Irreversible actions</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="destructive" className="w-full justify-start gap-2">
                <Trash2 className="w-4 h-4" />
                Delete All Data
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
