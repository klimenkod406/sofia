'use client'

import { Folder, MoreHorizontal, Pin, Archive, Star, Trash2, Edit, Copy, Tag, Clock, FileText } from 'lucide-react'
import { cn, formatRelativeTime, truncate } from '@/utils/cn'
import { Note } from '@/stores/notes'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

interface NoteCardProps {
  note: Note
  onClick: () => void
  variant?: 'default' | 'ghost'
}

export function NoteCard({ note, onClick, variant = 'default' }: NoteCardProps) {
  const baseClasses = "note-card group relative overflow-hidden transition-all duration-200"
  const variantClasses = {
    default: "bg-card hover:shadow-lg",
    ghost: "bg-muted/50 opacity-70 hover:opacity-100",
  }

  return (
    <article 
      className={cn(baseClasses, variantClasses[variant])}
      onClick={onClick}
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      role="button"
      aria-label={note.title}
    >
      {/* Cover */}
      {note.cover_image && (
        <div className="note-card-cover relative">
          <img 
            src={note.cover_image} 
            alt="" 
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        </div>
      )}
      {note.cover_color && !note.cover_image && (
        <div className="note-card-cover" style={{ backgroundColor: note.cover_color }} />
      )}

      {/* Content */}
      <div className="note-card-content">
        <div className="flex items-start justify-between gap-2">
          <h3 className={cn("note-card-title flex-1 min-w-0", note.is_pinned && "pr-6")}>
            {note.title}
            {note.is_pinned && <Pin className="w-4 h-4 text-primary flex-shrink-0 ml-1" />}
            {note.is_favorite && <Star className="w-4 h-4 text-amber-500 flex-shrink-0 ml-1 fill-current" />}
          </h3>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => onClick()}>
                <Edit className="w-4 h-4 mr-2" />
                Open
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Copy className="w-4 h-4 mr-2" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Pin className="w-4 h-4 mr-2" />
                {note.is_pinned ? 'Unpin' : 'Pin'}
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Star className="w-4 h-4 mr-2" />
                {note.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Archive className="w-4 h-4 mr-2" />
                {note.is_archived ? 'Unarchive' : 'Archive'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <p className="note-card-excerpt">{truncate(note.content_md || note.content, 120)}</p>

        <div className="note-card-meta">
          <div className="flex items-center gap-3">
            {note.folder_id && (
              <span className="flex items-center gap-1 text-xs">
                <Folder className="w-3 h-3" />
                {note.folder_id}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatRelativeTime(note.updated_at)}
            </span>
            <span className="flex items-center gap-1">
              <FileText className="w-3 h-3" />
              {note.word_count} words
            </span>
          </div>
          <span className="text-xs">{note.reading_time} min read</span>
        </div>
      </div>

      {/* Tags */}
      {note.tags && note.tags.length > 0 && (
        <div className="px-4 pb-3 flex flex-wrap gap-1.5">
          {note.tags.slice(0, 3).map((tag) => (
            <span
              key={tag.id}
              className="badge badge-outline text-xs"
              style={{ borderColor: tag.color, color: tag.color }}
            >
              <Tag className="w-3 h-3 mr-1" />
              {tag.name}
            </span>
          ))}
          {note.tags.length > 3 && (
            <span className="badge badge-outline text-xs">+{note.tags.length - 3}</span>
          )}
        </div>
      )}
    </article>
  )
}