import { useState, useEffect } from 'react';
import { Button } from '../../components/common/Button';
import { Toggle } from '../../components/common/Toggle';
import { useTranslation } from '../../i18n/I18nContext';

export function DiagnosticSection({
  className,
  sectionRef,
  verboseLogging,
  onVerboseLoggingChange,
  onCopyLogPath,
  onResolveLogPath,
}) {
  const { t } = useTranslation();
  const [copiedLogPath, setCopiedLogPath] = useState(null);
  const [resolvedLogPath, setResolvedLogPath] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (!onResolveLogPath) return undefined;
    onResolveLogPath().then((path) => {
      if (!cancelled && path) setResolvedLogPath(path);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [onResolveLogPath]);

  async function handleCopyLogPathClick() {
    if (!onCopyLogPath) return;
    const file = await onCopyLogPath();
    if (file) {
      setCopiedLogPath(file);
      setTimeout(() => setCopiedLogPath(null), 2200);
    }
  }

  return (
    <section id="diagnostic" className={className} ref={sectionRef}>
      <div className="opts-card-title">{t('options.diagnostic.title')}</div>
      <div className="opts-row">
        <div className="opts-row-info">
          <div className="opts-row-label">{t('options.diagnostic.verboseLabel')}</div>
          <div className="opts-row-sub">
            {t('options.diagnostic.verboseSub')}
          </div>
        </div>
        <Toggle on={!!verboseLogging} onChange={onVerboseLoggingChange} />
      </div>
      <div className="opts-row">
        <div className="opts-row-info">
          <div className="opts-row-label">{t('options.diagnostic.logFolderLabel')}</div>
          <div className="opts-row-sub">
            {resolvedLogPath ? (
              <><code>{resolvedLogPath}</code> — {t('options.diagnostic.logFolderCurrentFile')} <code>story-studio.log</code></>
            ) : (
              <>{t('options.diagnostic.logFolderFallbackGeneric')} {t('options.diagnostic.logFolderCurrentFile')} <code>story-studio.log</code></>
            )}
            {copiedLogPath ? (
              <span style={{ color: 'var(--accent-2-text)', marginLeft: 6 }}>{t('options.diagnostic.copiedTag')}</span>
            ) : null}
          </div>
        </div>
        <Button onClick={handleCopyLogPathClick} disabled={!onCopyLogPath} style={{ flexShrink: 0 }}>
          {t('options.diagnostic.copyPathButton')}
        </Button>
      </div>
      <div className="opts-help">
        {t('options.diagnostic.help')}
      </div>
    </section>
  );
}
