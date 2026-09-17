import { Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { SidebarNav } from '@/components/ui/sidebar-nav';
import { TitleBar } from '@/components/ui/title-bar';
import { PageLayout } from '@/components/ui/page-layout';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

// Lazy load pages for code splitting
const HomePage = lazy(() => import('@/pages/home').then(m => ({ default: m.HomePage })));
const EditorPage = lazy(() => import('@/pages/editor').then(m => ({ default: m.EditorPage })));
const CalendarPage = lazy(() =>
  import('@/pages/calendar').then(m => ({ default: m.CalendarPage }))
);
const SettingsPage = lazy(() =>
  import('@/pages/settings').then(m => ({ default: m.SettingsPage }))
);
const AIChatPage = lazy(() => import('@/pages/ai-chat').then(m => ({ default: m.AIChatPage })));

function App() {
  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-background">
      {/* Спокойный тёплый фон: два мягких пастельных пятна, без контраста */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-32 left-1/2 h-96 w-[60rem] -translate-x-1/2 rounded-full opacity-60 blur-3xl dark:opacity-30"
          style={{
            background: 'radial-gradient(closest-side, hsl(var(--secondary)), transparent)',
          }}
        />
        <div
          className="absolute -bottom-40 left-1/2 h-80 w-[50rem] -translate-x-1/2 rounded-full opacity-40 blur-3xl dark:opacity-20"
          style={{ background: 'radial-gradient(closest-side, hsl(var(--accent)), transparent)' }}
        />
      </div>

      {/* Custom window controls + drag region (Tauri only) */}
      <TitleBar />

      {/* Верхняя чёлка: без отступа, на всю ширину, сразу под TitleBar */}
      <SidebarNav />

      {/* Центральная сцена */}
      <main className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
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
              path="/editor/:noteId"
              element={
                <PageLayout width="narrow">
                  <EditorPage />
                </PageLayout>
              }
            />
            {/* Пустого редактора больше нет: вход в заметку только через
                главную (создание → /editor/:id). Легаси-ссылки уводим домой. */}
            <Route path="/editor" element={<Navigate to="/home" replace />} />
            <Route path="/editor/new" element={<Navigate to="/home" replace />} />
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
                <PageLayout width="narrow">
                  <SettingsPage />
                </PageLayout>
              }
            />
            <Route
              path="/ai-chat"
              element={
                <PageLayout width="narrow">
                  <AIChatPage />
                </PageLayout>
              }
            />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}

export default App;
