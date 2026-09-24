import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Suspense, lazy, useEffect } from 'react';
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
const ArchivePage = lazy(() => import('@/pages/archive').then(m => ({ default: m.ArchivePage })));

function App() {
  const location = useLocation();

  // Плавная смена палитры при входе/выходе из архива:
  // тёплые цвета → серая палитра. Переход CSS-переменных плавный
  // благодаря transition на body и компонентах.
  useEffect(() => {
    const isArchive = location.pathname.startsWith('/archive');
    document.body.classList.toggle('archive-theme', isArchive);
    return () => {
      document.body.classList.remove('archive-theme');
    };
  }, [location.pathname]);

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-background">
      {/* Спокойный тёплый фон: два мягких пастельных пятна, без контраста.
          При входе в архив они переключаются на серые тона — цвета
          «выползают» из верхней и нижней точек экрана. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden print:hidden"
      >
        <div className="theme-bleed theme-bleed-top" />
        <div className="theme-bleed theme-bleed-bottom" />
      </div>

      {/* Custom window controls + drag region + хлебные крошки + поиск.
          Шапка-оверлей: висит поверх контента, контент скроллится под ней
          до самого верха (элементы шапки поверх него). */}
      <TitleBar />

      {/* Центральная сцена: скроллится до верха окна, под прозрачной шапкой */}
      <main className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center">
              <LoadingSpinner />
            </div>
          }
        >
          <Routes>
            <Route path="/" element={<Navigate to="/home" replace />} />
            <Route
              path="/home"
              element={
                <PageLayout width="wide">
                  <HomePage />
                </PageLayout>
              }
            />
            <Route
              path="/editor/:noteId"
              element={
                <PageLayout fill>
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
                /* fill: календарь — полноэкранная сцена без внешнего скролла.
                   Таймлайны недели/дня прокручиваются внутри своих окон,
                   а не растягивают страницу на 24 часа. */
                <PageLayout fill>
                  <CalendarPage />
                </PageLayout>
              }
            />
            <Route
              path="/archive"
              element={
                <PageLayout width="wide">
                  <ArchivePage />
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
