'use client'

import { Editor } from '@tiptap/core'
import { Button } from '@/components/ui/button'
import { Type, Clock, FileText } from 'lucide-react'
import { Note } from '@/stores/notes'

interface EditorStatusBarProps {
  editor: Editor | null
  note: Note | null
  isSaving: boolean
}

export function EditorStatusBar({ editor, note, isSaving }: EditorStatusBarProps) {
  if (!editor) return null

  const text = editor.getText()
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0
  const charCount = text.length
  const readingTime = Math.max(1, Math.ceil(wordCount / 200))

  return (
    <div className="flex items-center justify-between border-t bg-surface-light dark:bg-surface-dark backdrop-blur-xl px-4 py-2">
      {/* Left: Stats */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        {note && (
          <span className="flex items-center gap-1">
            <FileText className="w-3.5 h-3.5" />
            {note.is_pinned && '📌 '}
            {note.is_archived && '📦 '}
            {note.is_favorite && '⭐ '}
            {note.title}
          </span>
        )}
        
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1" title="Word count">
            <Type className="w-3.5 h-3.5" />
            {wordCount.toLocaleString()} words
          </span>
          <span className="flex items-center gap-1" title="Character count">
            {charCount.toLocaleString()} chars
          </span>
          <span className="flex items-center gap-1" title="Reading time">
            <Clock className="w-3.5 h-3.5" />
            {readingTime} min
          </span>
        </div>
      </div>

      {/* Right: Actions & View Options */}
      <div className="flex items-center gap-2">
        {/* Save indicator */}
        <div className="flex items-center gap-2">
          {isSaving && (
            <span className="flex items-center gap-1 text-xs text-primary animate-pulse">
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Saving...
            </span>
          )}
          {!isSaving && note && (
            <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Saved
            </span>
          )}
        </div>

        {/* Focus mode */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          title="Focus mode"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="2" width="20" height="20" rx="2" />
          </svg>
        </Button>
      </div>
    </div>
  )
}
