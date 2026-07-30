import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { Button } from '../../components/common/Button';
import { KEYS, read as readSetting, write } from '../../store/persistentSettings';
import { isTauriRuntime } from '../../utils/tauriRuntime';
import { useTranslation } from '../../i18n/I18nContext';

export function YoutubeSection({ className, sectionRef }) {
  const { t } = useTranslation();
  const [ytDlpPath, setYtDlpPath] = useState(() => readSetting(KEYS.YTDLP_CUSTOM_PATH, { defaultValue: '' }));
  const [ytDlpUpdate, setYtDlpUpdate] = useState({ state: 'idle', message: '' });

  // Reflète la progression de mise à jour de yt-dlp (téléchargement).
  useEffect(() => {
    if (!isTauriRuntime()) return undefined;
    let cancelled = false;
    let unlisten = null;
    listen('youtube-log', (event) => {
      if (cancelled) return;
      setYtDlpUpdate((prev) => (prev.state === 'loading' ? { ...prev, message: String(event.payload) } : prev));
    }).then((fn) => {
      if (cancelled) fn();
      else unlisten = fn;
    }).catch(() => {});
    return () => { cancelled = true; if (unlisten) unlisten(); };
  }, []);

  function handleYtDlpPathChange(value) {
    setYtDlpPath(value);
    write(KEYS.YTDLP_CUSTOM_PATH, value);
  }

  async function handleUpdateYtDlp() {
    setYtDlpUpdate({ state: 'loading', message: t('options.youtube.updatingMessage') });
    try {
      await invoke('update_ytdlp');
      setYtDlpUpdate({ state: 'ok', message: t('options.youtube.updatedMessage') });
    } catch (e) {
      setYtDlpUpdate({ state: 'error', message: `${e}` });
    }
  }

  return (
    <section id="youtube" className={className} ref={sectionRef}>
      <div className="opts-card-title">{t('options.youtube.title')}</div>
      <div className="opts-help">
        {t('options.youtube.intro')}
      </div>
      <div className="opts-row">
        <div className="opts-row-info">
          <div className="opts-row-label">{t('options.youtube.updateLabel')}</div>
          <div className="opts-row-sub">
            {t('options.youtube.updateSub')}
          </div>
        </div>
        <Button onClick={handleUpdateYtDlp} disabled={ytDlpUpdate.state === 'loading'} style={{ flexShrink: 0 }}>
          {ytDlpUpdate.state === 'loading' ? t('options.youtube.updatingButton') : t('options.youtube.updateButton')}
        </Button>
      </div>
      {ytDlpUpdate.state !== 'idle' && (
        <div className={`info-box ${ytDlpUpdate.state === 'error' ? 'warn' : ''}`}>
          {ytDlpUpdate.message}
        </div>
      )}
      <div className="opts-row">
        <div className="opts-row-info">
          <div className="opts-row-label">{t('options.youtube.customPathLabel')}</div>
          <div className="opts-row-sub">
            {t('options.youtube.customPathSubPart1')} <code>yt-dlp.exe</code> {t('options.youtube.customPathSubPart2')} <code>yt-dlp</code>{' '}
            {t('options.youtube.customPathSubPart3')}
          </div>
        </div>
        <input
          className="xtts-input"
          type="text"
          spellCheck={false}
          placeholder={t('options.youtube.customPathPlaceholder')}
          value={ytDlpPath}
          onChange={(event) => handleYtDlpPathChange(event.target.value)}
          style={{ flex: 1, minWidth: 0 }}
        />
      </div>
    </section>
  );
}
