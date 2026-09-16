'use client'

import { useState } from 'react'
import { Folder, ChevronRight, Plus, MoreHorizontal, Edit, Trash2 } from 'lucide-react'
import { cn } from '@/utils/cn'
import { Folder as FolderType } from '@/stores/notes'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

interface FolderSidebarProps {
  folders: FolderType[]
  currentFolderId: string | null
  onSelect: (filter: { folderId: string | null }) => void
}

export function FolderSidebar({ folders, currentFolderId, onSelect }: FolderSidebarProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['root']))

  const rootFolders = folders.filter(f => !f.parent_id || f.parent_id === 'root')
  const folderChildren = new Map<string, FolderType[]>()
  folders.forEach(f => {
    if (f.parent_id) {
      const children = folderChildren.get(f.parent_id) || []
      children.push(f)
      folderChildren.set(f.parent_id, children)
    }
  })

  const toggleFolder = (id: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const renderFolder = (folder: FolderType, depth = 0) => {
    const children = folderChildren.get(folder.id) || []
    const isExpanded = expandedFolders.has(folder.id)
    const isActive = currentFolderId === folder.id
    const hasChildren = children.length > 0

    return (
      <div key={folder.id} className="folder-item relative">
        <div className={cn("flex items-center gap-2 w-full", isActive && "folder-item-active")} style={{ paddingLeft: `${depth * 16 + 8}px` }}>
          {hasChildren && (
            <button
              onClick={(e) => { e.stopPropagation(); toggleFolder(folder.id) }}
              className="flex-shrink-0 p-1 rounded hover:bg-accent transition-colors"
              aria-label={isExpanded ? `Collapse ${folder.name}` : `Expand ${folder.name}`}
            >
              <ChevronRight className={cn("w-4 h-4 transition-transform", isExpanded && "rotate-90")} />
            </button>
          )}
          
          <div 
            className="flex-1 flex items-center gap-2 min-w-0 cursor-pointer"
            onClick={() => onSelect({ folderId: folder.id })}
            style={{ color: folder.color }}
          >
            <span className="folder-icon" style={{ color: folder.color }}>
              <Folder className="w-4 h-4" />
            </span>
            <span className="truncate font-medium">{folder.name}</span>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity p-1">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem>
                <Plus className="w-4 h-4 mr-2" />
                New Subfolder
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Edit className="w-4 h-4 mr-2" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {isExpanded && hasChildren && (
          <div className="folder-children">
            {children.map(child => renderFolder(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col p-3">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Folders</h3>
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Create new folder">
          <Plus className="w-4 h-4" />
        </Button>
      </div>
      
      <nav className="folder-tree flex-1 overflow-y-auto" aria-label="Folder navigation">
        {rootFolders.map(folder => renderFolder(folder))}
      </nav>

      {/* Tags Section */}
      <div className="border-t pt-4 mt-4">
        <h3 className="font-semibold mb-2">Tags</h3>
        <div className="flex flex-wrap gap-1.5">
          {/* Tags would be rendered here */}
        </div>
      </div>
    </div>
  )
}