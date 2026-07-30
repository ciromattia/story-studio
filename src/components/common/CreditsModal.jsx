import { AppModalPortal } from './AppModalPortal';
import { Button } from './Button';
import { useTranslation } from '../../i18n/I18nContext';
import './CreditsModal.css';

/** Modale « À propos de Story Studio » (crédits). */
export function CreditsModal({ appVersion, onClose }) {
  const { t } = useTranslation();
  return (
    <AppModalPortal>
      <div className="modal-box credits-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span>{t('common.credits.title')}</span>
          <Button variant="icon" className="modal-close" onClick={onClose}>✕</Button>
        </div>
        <div className="credits-body">
          <div className="credits-head">
            <span className="credits-name">Story Studio</span>
            {appVersion && <span className="credits-version">v{appVersion}</span>}
          </div>
          <div className="credits-line">
            {t('common.credits.origin')}
          </div>
          <div className="credits-line">
            {t('common.credits.author')}
          </div>
          <div className="credits-line credits-thanks">
            {t('common.credits.thanksIntro')}<br />
            <strong>Jersou</strong>, <strong>Dantsu</strong>, <strong>o.Daneel</strong> {t('common.credits.namesConjunction')}{' '}
            <strong>LuckyTheCookie</strong>
          </div>
        </div>
      </div>
    </AppModalPortal>
  );
}
