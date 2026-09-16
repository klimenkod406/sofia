'use client'

import { useNavigate, useLocation } from 'react-router-dom'
import { Home, FileText, Calendar, Settings, Bot, Plus, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/utils/cn'
import { useSettings } from '@/stores/settings'

const navItems = [
  { path: '/home', label: 'Home', icon: Home, shortcut: 'H' },
  { path: '/editor', label: 'Editor', icon: FileText, shortcut: 'E' },
  { path: '/calendar', label: 'Calendar', icon: Calendar, shortcut: 'C' },
  { path: '/ai-chat', label: 'AI Chat', icon: Bot, shortcut: 'A' },
  { path: '/settings', label: 'Settings', icon: Settings, shortcut: 'S' },
] as const

export function SidebarNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const { uiPreferences, toggleSidebar } = useSettings()

  if (uiPreferences.sidebarCollapsed) {
    return (
      <button
        onClick={toggleSidebar}
        className="fixed top-4 left-1/2 -translate-x-1/2 z-50 glass-card p-2 rounded-xl hover:bg-accent transition-colors"
        aria-label="Expand sidebar"
      >
        <ChevronRight className="w-5 h-5 text-muted-foreground" />
      </button>
    )
  }

  return (
    <nav className="sidebar-nav" role="navigation" aria-label="Main navigation">
      <button
        onClick={() => navigate('/editor/new')}
        className="btn-primary text-xs px-3 py-1.5 gap-1.5"
        aria-label="Create new note"
      >
        <Plus className="w-4 h-4" />
        <span className="hidden sm:inline">New Note</span>
      </button>
      
      <div className="flex items-center gap-1" role="group" aria-label="Navigation">
        {navItems.map((item) => {
          const isActive = location.pathname.startsWith(item.path)
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                'sidebar-nav-item',
                isActive && 'sidebar-nav-item-active'
              )}
              aria-current={isActive ? 'page' : undefined}
              aria-label={`${item.label} (${item.shortcut})`}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
              <span className="hidden sm:inline">{item.label}</span>
            </button>
          )
        })}
      </div>

      <button
        onClick={toggleSidebar}
        className="ml-2 glass-card p-2 rounded-xl hover:bg-accent transition-colors"
        aria-label="Collapse sidebar"
      >
        <ChevronLeft className="w-5 h-5 text-muted-foreground" />
      </button>
    </nav>
  )
}