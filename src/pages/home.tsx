'use client'

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Filter, MoreVertical, Pin, Archive, FileText } from 'lucide-react'
import { useNotes } from '@/stores/notes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { NoteCard } from '@/components/home/note-card'
import { FolderSidebar } from '@/components/home/folder-sidebar'

export function HomePage() {
  const navigate = useNavigate()
  const { notes, folders, isLoading, loadNotes, loadFolders, filter, setFilter, createNote } = useNotes()
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    loadNotes()
    loadFolders()
  }, [loadNotes, loadFolders])

  useEffect(() => {
    const debounce = setTimeout(() => {
      setFilter({ searchQuery })
    }, 300)
    return () => clearTimeout(debounce)
  }, [searchQuery, setFilter])

  const pinnedNotes = notes.filter(n => n.is_pinned && !n.is_archived && !n.is_deleted)
  const regularNotes = notes.filter(n => !n.is_pinned && !n.is_archived && !n.is_deleted)
  const archivedNotes = notes.filter(n => n.is_archived && !n.is_deleted)

  const handleNewNote = async () => {
    const note = await createNote(filter.folderId ?? undefined)
    navigate(`/editor/${note.id}`)
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Σόφια</h1>
          <p className="text-muted-foreground">Your intelligent note-taking companion</p>
        </div>
        <Button onClick={handleNewNote} className="gap-2">
          <Plus className="w-4 h-4" />
          New Note
        </Button>
      </div>

      {/* Search and Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="relative">
            <Filter className="w-4 h-4" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full" />
          </Button>
          <Button variant="outline" size="icon">
            <MoreVertical className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Folder Sidebar */}
        <aside className="w-64 flex-shrink-0 border-r hidden lg:block">
          <FolderSidebar folders={folders} currentFolderId={filter.folderId} onSelect={setFilter} />
        </aside>

        {/* Notes List */}
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-6">
              {/* Pinned Notes */}
              {pinnedNotes.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <Pin className="w-4 h-4 text-primary" />
                    <h2 className="font-semibold">Pinned ({pinnedNotes.length})</h2>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {pinnedNotes.map((note) => (
                      <NoteCard key={note.id} note={note} onClick={() => navigate(`/editor/${note.id}`)} />
                    ))}
                  </div>
                </section>
              )}

              {/* Regular Notes */}
              <section>
                {regularNotes.length === 0 && !isLoading && (
                  <div className="flex flex-col items-center justify-center h-64 text-center text-muted-foreground">
                    <FileText className="w-12 h-12 mb-4 opacity-50" />
                    <h3 className="text-lg font-medium mb-1">No notes yet</h3>
                    <p className="mb-4">Create your first note to get started</p>
                    <Button onClick={handleNewNote} className="gap-2">
                      <Plus className="w-4 h-4" />
                      Create Note
                    </Button>
                  </div>
                )}

                {regularNotes.length > 0 && (
                  <>
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="font-semibold">Notes ({regularNotes.length})</h2>
                      <select
                        value={`${filter.sortBy}:${filter.sortOrder}`}
                        onChange={(e) => {
                          const [sortBy, sortOrder] = e.target.value.split(':')
                          setFilter({ sortBy, sortOrder: sortOrder as 'asc' | 'desc' })
                        }}
                        className="input w-auto text-sm py-1"
                      >
                        <option value="updated_at:desc">Latest Modified</option>
                        <option value="created_at:desc">Latest Created</option>
                        <option value="title:asc">Title (A-Z)</option>
                        <option value="title:desc">Title (Z-A)</option>
                        <option value="word_count:desc">Word Count (High-Low)</option>
                      </select>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {regularNotes.map((note) => (
                        <NoteCard key={note.id} note={note} onClick={() => navigate(`/editor/${note.id}`)} />
                      ))}
                    </div>
                  </>
                )}
              </section>

              {/* Archived Notes */}
              {archivedNotes.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <Archive className="w-4 h-4 text-muted-foreground" />
                    <h2 className="font-semibold text-muted-foreground">Archived ({archivedNotes.length})</h2>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {archivedNotes.map((note) => (
                      <NoteCard key={note.id} note={note} onClick={() => navigate(`/editor/${note.id}`)} variant="ghost" />
                    ))}
                  </div>
                </section>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}
