'use client';

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAIChat } from '@/hooks/use-ai-chat';
import { MessageBubble } from '@/components/ai/message-bubble';
import { ModelSelector } from '@/components/ai/model-selector';
import { Button } from '@/components/ui/button';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sparkles, Send, Mic, Loader2, X } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useTranslation } from '@/lib/i18n';

export function AIChatPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { messages, isLoading, currentModel, availableModels, sendMessage, setModel, clearChat } =
    useAIChat();

  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const text = input.trim();
    setInput('');
    await sendMessage(text);
  };

  const handleSuggestion = async (suggestion: string) => {
    if (isLoading) return;
    await sendMessage(suggestion);
  };

  const handleVoiceInput = () => {
    // TODO: Implement voice recording
    setIsRecording(!isRecording);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-surface-light dark:bg-surface-dark backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <Breadcrumbs
            onBack={() => navigate('/home')}
            parentLabel={t('home')}
            current={t('aiAssistant')}
            className="justify-start"
          />
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">{t('aiAssistant')}</h1>
            <p className="text-sm text-muted-foreground">{t('aiChatDesc')}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ModelSelector currentModel={currentModel} models={availableModels} onSelect={setModel} />
          <Button variant="ghost" size="icon" onClick={clearChat} disabled={messages.length === 0}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1" ref={scrollAreaRef}>
        <div className="p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center text-muted-foreground">
              <Sparkles className="w-16 h-16 mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">{t('startConversation')}</h3>
              <p className="max-w-xs">{t('startConversationDesc')}</p>
              <div className="mt-6 flex flex-wrap gap-2 justify-center">
                {[
                  t('suggestion1'),
                  t('suggestion2'),
                  t('suggestion3'),
                  t('suggestion4'),
                  t('suggestion5'),
                ].map(suggestion => (
                  <Button
                    key={suggestion}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => void handleSuggestion(suggestion)}
                  >
                    {suggestion}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message, index) => (
              <MessageBubble key={`${message.id}-${index}`} message={message} />
            ))
          )}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="border-t p-4 bg-surface-light dark:bg-surface-dark backdrop-blur-xl"
      >
        <div className="flex items-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleVoiceInput}
            className={cn(isRecording && 'text-primary animate-pulse')}
            disabled={isLoading}
          >
            <Mic className="w-5 h-5" />
          </Button>

          <div className="flex-1 relative">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={isLoading ? t('aiThinking') : t('aiInputPlaceholder')}
              disabled={isLoading}
              className={cn(
                'textarea resize-none min-h-[44px] max-h-[200px] pr-12',
                isLoading && 'opacity-50'
              )}
              rows={1}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void handleSubmit(e);
                }
              }}
            />
          </div>

          <Button type="submit" size="icon" disabled={isLoading || !input.trim()} className="h-10">
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </Button>
        </div>

        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>{t('modelLabel', { name: currentModel?.name || t('selectModel') })}</span>
          <span>{t('shiftEnter')}</span>
        </div>
      </form>
    </div>
  );
}
