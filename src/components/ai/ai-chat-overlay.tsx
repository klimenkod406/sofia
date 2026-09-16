'use client'

import { useEffect, useRef } from 'react'
import { AIChatPage } from '@/pages/ai-chat'
import { X, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface AIChatOverlayProps {
  noteId?: string
  onClose: () => void
}

export function AIChatOverlay({ noteId, onClose }: AIChatOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  useEffect(() => {
    // Focus trap
    const focusableElements = overlayRef.current?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    const firstElement = focusableElements?.[0] as HTMLElement
    const lastElement = focusableElements?.[focusableElements.length - 1] as HTMLElement

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault()
          lastElement?.focus()
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault()
          firstElement?.focus()
        }
      }
    }

    document.addEventListener('keydown', handleTab)
    firstElement?.focus()
    return () => document.removeEventListener('keydown', handleTab)
  }, [])

  return (
    <div 
      ref={overlayRef}
      className="fixed inset-0 z-50 flex flex-col bg-background/98 backdrop-blur-lg animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-chat-title"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-surface-light dark:bg-surface-dark backdrop-blur-xl sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h2 id="ai-chat-title" className="font-semibold">AI Assistant</h2>
            <p className="text-xs text-muted-foreground">Context: {noteId ? 'Current Note' : 'General'}</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Chat Content */}
      <div className="flex-1 overflow-hidden">
        <AIChatPage />
      </div>
    </div>
  )
}