'use client';

import { useRef, useImperativeHandle, forwardRef } from 'react';
import { cn } from '@/utils/cn';
import { Button } from '@/components/ui/button';
import { Sparkles, Mic, Paperclip, Smile } from 'lucide-react';

interface ChatInputRef {
  focus: () => void;
  clear: () => void;
}

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export const ChatInput = forwardRef<ChatInputRef, ChatInputProps>(
  ({ value, onChange, onSubmit, disabled, placeholder }, ref) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useImperativeHandle(ref, () => ({
      focus: () => textareaRef.current?.focus(),
      clear: () => onChange(''),
    }));

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (value.trim() && !disabled) {
          onSubmit(value);
          onChange('');
        }
      }
    };

    return (
      <div className="flex items-end gap-2 p-4 border-t bg-surface-light dark:bg-surface-dark backdrop-blur-xl">
        <Button variant="ghost" size="icon" disabled={disabled} aria-label="Attach file">
          <Paperclip className="w-5 h-5" />
        </Button>

        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={e => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder || 'Type a message...'}
            disabled={disabled}
            className={cn(
              'textarea resize-none min-h-[44px] max-h-[200px] pr-12',
              disabled && 'opacity-50'
            )}
            rows={1}
            style={{ height: 'auto' }}
          />
        </div>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" disabled={disabled} aria-label="Add emoji">
            <Smile className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="icon" disabled={disabled} aria-label="Voice input">
            <Mic className="w-5 h-5" />
          </Button>
          <Button
            type="submit"
            size="icon"
            disabled={disabled || !value.trim()}
            className="ml-1 h-10 w-10 rounded-xl"
            aria-label="Send message"
          >
            <Sparkles className="w-5 h-5" />
          </Button>
        </div>
      </div>
    );
  }
);

ChatInput.displayName = 'ChatInput';
