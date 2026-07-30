import { TriangleAlert } from '../icons/LucideLocal';
import { useTranslation } from '../../i18n/I18nContext';
import './ImportNoticeToast.css';

/** Bandeau d'avertissement ancré en bas (notice d'import). */
export function ImportNoticeToast({ message, onClose }) {
  const { t } = useTranslation();
  return (
    <div className="import-notice">
      <span className="import-notice-text">
        <TriangleAlert className="import-notice-icon" />
        <span>{message}</span>
      </span>
      <button className="import-notice-close" onClick={onClose} title={t('common.close')}>✕</button>
    </div>
  );
}
