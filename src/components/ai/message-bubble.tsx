'use client'

import { cn } from '@/utils/cn'
import { formatRelativeTime } from '@/utils/cn'
import { Copy, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AIMessage } from '@/types'

interface MessageBubbleProps {
  message: AIMessage
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const isLoading = message.content === '' && message.role === 'assistant'

  return (
    <div className={cn('flex gap-3 animate-fade-in', isUser && 'flex-row-reverse')}>
      <div className={cn('w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0', isUser ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground')}>
        {isUser ? (
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        ) : (
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="2" width="20" height="20" rx="2" />
          </svg>
        )}
      </div>
      
      <div className={cn('flex-1 max-w-[80%]', isUser ? 'text-right' : '')}>
        <div className={cn(
          'inline-block px-4 py-2 rounded-2xl',
          isUser ? 'bg-primary text-primary-foreground rounded-tr-none' : 'bg-secondary text-secondary-foreground rounded-tl-none'
        )}>
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Thinking...</span>
            </div>
          ) : (
            <div className={cn('prose prose-sm max-w-none', isUser ? 'text-primary-foreground' : '')}>
              {message.content}
            </div>
          )}
        </div>
        
        <div className={cn('flex items-center gap-1 mt-1', isUser ? 'justify-end' : '')}>
          <span className="text-xs opacity-50">{formatRelativeTime(message.created_at)}</span>
          {!isLoading && !isUser && (
            <Button variant="ghost" size="icon" className="h-6 w-6 p-0" title="Copy">
              <Copy className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}