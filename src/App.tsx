import { Routes, Route, Navigate } from 'react-router-dom'
import { Suspense, lazy } from 'react'
import { SidebarNav } from '@/components/ui/sidebar-nav'
import { TitleBar } from '@/components/ui/title-bar'
import { PageLayout } from '@/components/ui/page-layout'
import { LoadingSpinner } from '@/components/ui/loading-spinner'

// Lazy load pages for code splitting
const HomePage = lazy(() => import('@/pages/home').then(m => ({ default: m.HomePage })))
const EditorPage = lazy(() => import('@/pages/editor').then(m => ({ default: m.EditorPage })))
const CalendarPage = lazy(() => import('@/pages/calendar').then(m => ({ default: m.CalendarPage })))
const SettingsPage = lazy(() => import('@/pages/settings').then(m => ({ default: m.SettingsPage })))
const AIChatPage = lazy(() => import('@/pages/ai-chat').then(m => ({ default: m.AIChatPage })))

function App() {
  return (
    <div className="h-full flex flex-col bg-background">
      {/* Custom window controls + drag region (Tauri only) */}
      <TitleBar />

      {/* Top Center Sidebar Navigation */}
      <SidebarNav />
      
      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        <Suspense fallback={<LoadingSpinner />}>
          <Routes>
            <Route path="/" element={<Navigate to="/home" replace />} />
            <Route
              path="/home"
              element={
                <PageLayout>
                  <HomePage />
                </PageLayout>
              }
            />
            <Route
              path="/editor/:noteId?"
              element={
                <PageLayout>
                  <EditorPage />
                </PageLayout>
              }
            />
            <Route
              path="/calendar"
              element={
                <PageLayout>
                  <CalendarPage />
                </PageLayout>
              }
            />
            <Route
              path="/settings"
              element={
                <PageLayout>
                  <SettingsPage />
                </PageLayout>
              }
            />
            <Route
              path="/ai-chat"
              element={
                <PageLayout>
                  <AIChatPage />
                </PageLayout>
              }
            />
          </Routes>
        </Suspense>
      </main>
    </div>
  )
}

export default App