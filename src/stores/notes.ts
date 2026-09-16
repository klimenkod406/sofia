'use client'

import { create } from 'zustand'
import { invoke } from '@tauri-apps/api/core'

export interface Note {
  id: string
  folder_id: string | null
  title: string
  content: string
  content_md: string
  content_html: string
  excerpt: string
  word_count: number
  char_count: number
  reading_time: number
  is_pinned: boolean
  is_archived: boolean
  is_deleted: boolean
  is_favorite: boolean
  cover_image: string | null
  cover_color: string | null
  template_id: string | null
  tags?: Tag[]
  created_at: string
  updated_at: string
  deleted_at: string | null
  last_edited_at: string
}

export interface Folder {
  id: string
  name: string
  parent_id: string | null
  color: string
  icon: string
  sort_order: number
  is_system: boolean
  created_at: string
  updated_at: string
}

export interface Tag {
  id: string
  name: string
  color: string
  icon: string
  usage_count: number
}

interface NotesState {
  notes: Note[]
  folders: Folder[]
  tags: Tag[]
  currentNote: Note | null
  currentFolder: Folder | null
  filter: {
    folderId: string | null
    searchQuery: string
    sortBy: string
    sortOrder: 'asc' | 'desc'
    showPinned: boolean
    showArchived: boolean
    showDeleted: boolean
  }
  isLoading: boolean
  error: string | null

  // Actions
  loadNotes: () => Promise<void>
  loadFolders: () => Promise<void>
  loadTags: () => Promise<void>
  createNote: (folderId?: string, title?: string) => Promise<Note>
  getNote: (id: string) => Promise<Note | null>
  updateNote: (note: Partial<Note> & { id: string }) => Promise<void>
  deleteNote: (id: string, permanent?: boolean) => Promise<void>
  searchNotes: (query: string) => Promise<void>
  setCurrentNote: (note: Note | null) => void
  setCurrentFolder: (folder: Folder | null) => void
  setFilter: (filter: Partial<NotesState['filter']>) => void
  pinNote: (id: string, pinned: boolean) => Promise<void>
  archiveNote: (id: string, archived: boolean) => Promise<void>
  favoriteNote: (id: string, favorite: boolean) => Promise<void>
  moveNote: (noteId: string, folderId: string | null) => Promise<void>
  duplicateNote: (id: string) => Promise<Note>
  createFolder: (name: string, parentId?: string) => Promise<Folder>
  updateFolder: (folder: Folder) => Promise<void>
  deleteFolder: (id: string, recursive?: boolean) => Promise<void>
  createTag: (name: string, color?: string) => Promise<Tag>
  addTagToNote: (noteId: string, tagId: string) => Promise<void>
  removeTagFromNote: (noteId: string, tagId: string) => Promise<void>
}

export const useNotes = create<NotesState>((set, get) => ({
  notes: [],
  folders: [],
  tags: [],
  currentNote: null,
  currentFolder: null,
  filter: {
    folderId: null,
    searchQuery: '',
    sortBy: 'updated_at',
    sortOrder: 'desc',
    showPinned: false,
    showArchived: false,
    showDeleted: false,
  },
  isLoading: false,
  error: null,

  loadNotes: async () => {
    set({ isLoading: true, error: null })
    try {
      const { filter } = get()
      const notes = await invoke('list_notes', {
        filter: {
          folder_id: filter.folderId,
          is_pinned: filter.showPinned ? true : undefined,
          is_archived: filter.showArchived ? true : undefined,
          is_deleted: filter.showDeleted ? true : undefined,
          search_query: filter.searchQuery || undefined,
          sort_by: filter.sortBy,
          sort_order: filter.sortOrder,
          page: 1,
          per_page: 100,
        }
      }) as Note[]
      set({ notes, isLoading: false })
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false })
    }
  },

  loadFolders: async () => {
    try {
      const folders = await invoke('list_folders', { parent_id: null }) as Folder[]
      set({ folders })
    } catch (error) {
      console.error('Failed to load folders:', error)
    }
  },

  loadTags: async () => {
    try {
      const tags = await invoke('list_tags', { include_system: true }) as Tag[]
      set({ tags })
    } catch (error) {
      console.error('Failed to load tags:', error)
    }
  },

  createNote: async (folderId, title) => {
    const note = await invoke('create_note', { folder_id: folderId, title }) as Note
    set((state) => ({ notes: [note, ...state.notes] }))
    return note
  },

  getNote: async (id) => {
    return await invoke('get_note', { id }) as Note | null
  },

  updateNote: async (note) => {
    await invoke('update_note', { request: note })
    set((state) => ({
      notes: state.notes.map((n) => (n.id === note.id ? { ...n, ...note } : n)),
      currentNote: state.currentNote?.id === note.id ? { ...state.currentNote, ...note } : state.currentNote,
    }))
  },

  deleteNote: async (id, permanent = false) => {
    await invoke('delete_note', { id, permanent })
    set((state) => ({
      notes: state.notes.filter((n) => n.id !== id),
      currentNote: state.currentNote?.id === id ? null : state.currentNote,
    }))
  },

  searchNotes: async (query) => {
    set({ isLoading: true })
    try {
      const notes = await invoke('search_notes', { query, limit: 50 }) as Note[]
      set({ notes, isLoading: false })
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false })
    }
  },

  setCurrentNote: (note) => set({ currentNote: note }),
  setCurrentFolder: (folder) => set({ currentFolder: folder }),

  setFilter: (filter) => set((state) => ({
    filter: { ...state.filter, ...filter }
  })),

  pinNote: async (id, pinned) => {
    await invoke('pin_note', { id, pinned })
    set((state) => ({
      notes: state.notes.map((n) => (n.id === id ? { ...n, is_pinned: pinned } : n)),
    }))
  },

  archiveNote: async (id, archived) => {
    await invoke('archive_note', { id, archived })
    set((state) => ({
      notes: state.notes.map((n) => (n.id === id ? { ...n, is_archived: archived } : n)),
    }))
  },

  favoriteNote: async (id, favorite) => {
    await invoke('favorite_note', { id, favorite })
    set((state) => ({
      notes: state.notes.map((n) => (n.id === id ? { ...n, is_favorite: favorite } : n)),
    }))
  },

  moveNote: async (noteId, folderId) => {
    await invoke('move_note', { note_id: noteId, folder_id: folderId })
    set((state) => ({
      notes: state.notes.map((n) => (n.id === noteId ? { ...n, folder_id: folderId } : n)),
    }))
  },

  duplicateNote: async (id) => {
    const note = await invoke('duplicate_note', { id }) as Note
    set((state) => ({ notes: [note, ...state.notes] }))
    return note
  },

  createFolder: async (name, parentId) => {
    const folder = await invoke('create_folder', { name, parent_id: parentId }) as Folder
    set((state) => ({ folders: [...state.folders, folder] }))
    return folder
  },

  updateFolder: async (folder) => {
    await invoke('update_folder', { folder })
    set((state) => ({
      folders: state.folders.map((f) => (f.id === folder.id ? folder : f)),
    }))
  },

  deleteFolder: async (id, recursive = false) => {
    await invoke('delete_folder', { id, recursive })
    set((state) => ({
      folders: state.folders.filter((f) => f.id !== id),
    }))
  },

  createTag: async (name, color) => {
    const tag = await invoke('create_tag', { name, color }) as Tag
    set((state) => ({ tags: [...state.tags, tag] }))
    return tag
  },

  addTagToNote: async (noteId, tagId) => {
    await invoke('add_tag_to_note', { note_id: noteId, tag_id: tagId })
    // Refresh tags
    get().loadTags()
  },

  removeTagFromNote: async (noteId, tagId) => {
    await invoke('remove_tag_from_note', { note_id: noteId, tag_id: tagId })
    get().loadTags()
  },
}))