'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface SplashScreenProps {
  /**
   * Сколько миллисекунд дополнительно показывать заставку после окончания
   * видео — чтобы убрать резкий «прыжок», пока UI первого маршрута
   * прорисовывается за оверлеем.
   */
  minVisibleMs?: number;
}

const DEFAULT_MIN_MS = 600;

const SPLASH_BG = '#F8F5F1';

/**
 * Полноэкранная загрузочная заставка: проигрывает `public/intro.mp4` поверх
 * всего приложения, пока видео не закончится, после чего плавно затухает
 * и размонтируется.
 *
 * Зрительский опыт спроектирован так, чтобы окно Tauri не «мигало»:
 *  — на уровне ОС окно сразу рисуется с `backgroundColor: SPLASH_BG`
 *    (см. tauri.conf.json: `windows[0].backgroundColor`);
 *  — `<body>` и `<div id="root">` в `index.html` того же цвета, поэтому
 *    между нативной отрисовкой и маунтингом React нет белой вспышки;
 *  — `<video>` использует `object-cover`, чтобы целиком заполнить viewport
 *    без band'ов; его `background-color` задан явно, но при `cover` он
 *    виден лишь в первом кадре до декодирования (фон той же темы).
 *
 * Пропуск заставки пользователем не предусмотрен: это «лицо» приложения и
 * должно доигрывать до конца. Если видео по какой-то причине не
 * заканчивается (ошибка декодирования, отказ автоплея), срабатывает
 * запасной таймаут и оверлей всё равно закрывается.
 */
export function SplashScreen({ minVisibleMs = DEFAULT_MIN_MS }: SplashScreenProps = {}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const startedAtRef = useRef<number>(performance.now());
  const [ready, setReady] = useState(false);
  const [fading, setFading] = useState(false);

  const dismiss = useCallback(() => {
    setFading(true);
    // Плавное затухание → unmount после окончания CSS-перехода. Когда
    // `fading` выставлен, оверлей пропускает клики, чтобы пользователь
    // мог параллельно взаимодействовать с уже загруженным UI, не дожидаясь
    // полного размонтирования.
    window.setTimeout(() => setReady(true), 600);
  }, []);

  // Когда видео закончилось — обязательно держать заставку как минимум
  // `minVisibleMs` с момента запуска (даже если декодирование заняло 0 мс),
  // иначе в случае почти-мгновенного `ended` оверлей «моргнёт».
  const handleEnded = useCallback(() => {
    const elapsed = performance.now() - startedAtRef.current;
    const left = Math.max(0, minVisibleMs - elapsed);
    window.setTimeout(dismiss, left);
  }, [dismiss, minVisibleMs]);

  // Аудио в маленьких webview зачастую блокируется автоплеем-политиками,
  // а само видео может «не стартовать» из-за gesture restriction.
  // muted=true — единственный надёжный способ проиграть превью без
  // клика. Если всё-таки play() отвергнут, закрываем оверлей по таймауту,
  // чтобы приложение не висело.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    v.playsInline = true;
    const playPromise = v.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        const elapsed = performance.now() - startedAtRef.current;
        const left = Math.max(1500, minVisibleMs - elapsed + 1500);
        window.setTimeout(dismiss, left);
      });
    }
  }, [dismiss, minVisibleMs]);

  if (ready) return null;

  return (
    <div
      role="status"
      aria-label="Загрузка приложения"
      // onClick/onKeyDown намеренно отсутствуют: пропуска заставки не
      // предусмотрено. Любые клики и нажатия во время показа сплеша
      // поглощает сам оверлей (под ним React только-только рисует
      // первый маршрут).
      className={[
        'fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden',
        'transition-opacity duration-500 ease-out',
        fading ? 'pointer-events-none opacity-0' : 'opacity-100',
      ].join(' ')}
      style={{ backgroundColor: SPLASH_BG }}
    >
      <video
        ref={videoRef}
        src="/intro.mp4"
        // `object-cover` обрезает кадр по большей стороне и заполняет
        // viewport целиком — никаких band'ов. Видео 16:9 на окне 16:10
        // даёт обрезку ~12% сверху/снизу; композиция ликорисов устойчива
        // к этому (верх/бока кадра пустые), стебли в центре сохраняются.
        className="h-full w-full object-cover"
        autoPlay
        muted
        playsInline
        preload="auto"
        onEnded={handleEnded}
        // Страховка на случай, если mp4 не загрузится (404, CORS, битый
        // контейнер) — не оставлять пользователя вечно смотреть на фон.
        onError={() => window.setTimeout(dismiss, 1000)}
        style={{ backgroundColor: SPLASH_BG }}
      />
    </div>
  );
}
