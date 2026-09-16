'use client'

import type { useEditor } from '@tiptap/react'
import type { Level } from '@tiptap/extension-heading'
import { cn } from '@/utils/cn'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import {
  Bold, Italic, Strikethrough, Code, Heading1, Heading2, Heading3,
  List, ListOrdered, Quote, Link, Image, Table,
  Undo, Redo, Save, Highlighter, CheckSquare,
  MoreHorizontal, Type, Download,
} from 'lucide-react'

interface EditorToolbarProps {
  editor: ReturnType<typeof useEditor>
}

interface ToolbarButton {
  kind: 'button'
  icon: React.ComponentType<{ className?: string }>
  action: () => boolean | void
  disabled?: boolean
  active?: boolean
  title: string
}

interface ToolbarMenu {
  kind: 'menu'
  icon: React.ComponentType<{ className?: string }>
  action: () => void
  title: string
  menuItems: { icon: React.ComponentType<{ className?: string }>; label: string; action: () => void }[]
}

type ToolbarItem = ToolbarButton | ToolbarMenu

export function EditorToolbar({ editor }: EditorToolbarProps) {
  if (!editor) return null

  const canUndo = editor.can().undo()
  const canRedo = editor.can().redo()

  const addHeading = (level: Level) => {
    editor.chain().focus().toggleHeading({ level }).run()
  }

  const addTable = () => {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
  }

  const addTaskList = () => {
    editor.chain().focus().toggleTaskList().run()
  }

  const addLink = () => {
    const url = window.prompt('Enter URL:')
    if (url) editor.chain().focus().setLink({ href: url }).run()
  }

  const addImage = () => {
    const url = window.prompt('Enter image URL:')
    if (url) editor.chain().focus().setImage({ src: url }).run()
  }

  const groups: ToolbarItem[][] = [
    // History
    [
      { kind: 'button', icon: Undo, action: () => editor.chain().focus().undo().run(), disabled: !canUndo, title: 'Undo (Ctrl+Z)' },
      { kind: 'button', icon: Redo, action: () => editor.chain().focus().redo().run(), disabled: !canRedo, title: 'Redo (Ctrl+Shift+Z)' },
    ],
    // Text formatting
    [
      { kind: 'button', icon: Bold, action: () => editor.chain().focus().toggleBold().run(), active: editor.isActive('bold'), title: 'Bold (Ctrl+B)' },
      { kind: 'button', icon: Italic, action: () => editor.chain().focus().toggleItalic().run(), active: editor.isActive('italic'), title: 'Italic (Ctrl+I)' },
      { kind: 'button', icon: Strikethrough, action: () => editor.chain().focus().toggleStrike().run(), active: editor.isActive('strike'), title: 'Strikethrough' },
      { kind: 'button', icon: Code, action: () => editor.chain().focus().toggleCode().run(), active: editor.isActive('code'), title: 'Inline Code' },
      { kind: 'button', icon: Highlighter, action: () => editor.chain().focus().toggleHighlight().run(), active: editor.isActive('highlight'), title: 'Highlight' },
    ],
    // Headings
    [
      {
        kind: 'button',
        icon: Heading1,
        action: () => addHeading(1),
        active: editor.isActive('heading', { level: 1 }),
        title: 'Heading 1',
      },
      {
        kind: 'button',
        icon: Heading2,
        action: () => addHeading(2),
        active: editor.isActive('heading', { level: 2 }),
        title: 'Heading 2',
      },
      {
        kind: 'button',
        icon: Heading3,
        action: () => addHeading(3),
        active: editor.isActive('heading', { level: 3 }),
        title: 'Heading 3',
      },
    ],
    // Lists
    [
      { kind: 'button', icon: List, action: () => editor.chain().focus().toggleBulletList().run(), active: editor.isActive('bulletList'), title: 'Bullet List' },
      { kind: 'button', icon: ListOrdered, action: () => editor.chain().focus().toggleOrderedList().run(), active: editor.isActive('orderedList'), title: 'Numbered List' },
      { kind: 'button', icon: CheckSquare, action: addTaskList, active: editor.isActive('taskList'), title: 'Task List' },
    ],
    // Blocks
    [
      { kind: 'button', icon: Quote, action: () => editor.chain().focus().toggleBlockquote().run(), active: editor.isActive('blockquote'), title: 'Blockquote' },
      { kind: 'button', icon: Code, action: () => editor.chain().focus().toggleCodeBlock().run(), active: editor.isActive('codeBlock'), title: 'Code Block' },
    ],
    // Media & Tables
    [
      { kind: 'button', icon: Link, action: addLink, title: 'Add Link (Ctrl+K)' },
      { kind: 'button', icon: Image, action: addImage, title: 'Add Image' },
      { kind: 'button', icon: Table, action: addTable, title: 'Insert Table' },
    ],
    // More
    [
      {
        kind: 'menu',
        icon: MoreHorizontal,
        action: () => {},
        title: 'More Options',
        menuItems: [
          { icon: Type, label: 'Clear Formatting', action: () => { editor.chain().focus().clearNodes().run() } },
          { icon: Save, label: 'Save Note', action: () => {} }, // Handled by page
          { icon: Download, label: 'Export as Markdown', action: () => {} },
          { icon: Download, label: 'Export as HTML', action: () => {} },
          { icon: Download, label: 'Export as PDF', action: () => {} },
        ],
      },
    ],
  ]

  return (
    <div className="editor-toolbar" role="toolbar" aria-label="Editor formatting tools">
      {groups.map((group, groupIndex) => (
        <div key={groupIndex} className="flex items-center gap-1">
          {group.map((item, itemIndex) => (
            <div key={itemIndex}>
              {item.kind === 'menu' ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="editor-toolbar-btn"
                      onClick={item.action}
                      title={item.title}
                      aria-label={item.title}
                    >
                      <item.icon className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    {item.menuItems.map((menuItem, mi) => (
                      <DropdownMenuItem key={mi} onClick={menuItem.action} className="flex items-center gap-2">
                        <menuItem.icon className="w-4 h-4" />
                        {menuItem.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'editor-toolbar-btn',
                    item.active && 'editor-toolbar-btn-active'
                  )}
                  onClick={item.action}
                  disabled={item.disabled}
                  title={item.title}
                  aria-label={item.title}
                  aria-pressed={item.active}
                >
                  <item.icon className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))}
          {groupIndex < groups.length - 1 && <div className="w-px h-6 bg-border mx-1" />}
        </div>
      ))}
    </div>
  )
}
