import { Check } from '../icons/LucideLocal';
import { useTranslation } from '../../i18n/I18nContext';

/**
 * Écran « Terminé » du châssis pour les funnels génératifs/outils.
 * Pastille succès + titre + nom de fichier (optionnel) + méta + zone d'actions.
 *
 * Les actions sont fournies par le funnel (`children`) : typiquement un bouton
 * secondaire « Ouvrir le dossier » (neutre) et un bouton orange « Terminer »
 * qui ferme le funnel et revient à l'accueil. On laisse le consommateur composer
 * pour ne pas figer la sortie.
 *
 * @param {Object}   props
 * @param {React.ReactNode} [props.icon]   Défaut : coche succès.
 * @param {'success'|'error'} [props.tone='success']  Couleur de la pastille.
 * @param {string}   [props.title]  Défaut : traduction de `funnels.doneState.defaultTitle`.
 * @param {string}   [props.fileName]
 * @param {string}   [props.meta]
 * @param {React.ReactNode} props.children  Boutons d'action.
 */
export function FunnelDoneState({ icon, tone = 'success', title, fileName, meta, children }) {
  const { t } = useTranslation();
  const resolvedTitle = title ?? t('funnels.doneState.defaultTitle');
  return (
    <div className="funnel-done">
      <div className={`funnel-done-badge${tone === 'error' ? ' funnel-done-badge--error' : ''}`} aria-hidden="true">
        {icon ?? <Check strokeWidth={2.6} />}
      </div>
      <div className="funnel-done-title">{resolvedTitle}</div>
      {fileName ? <div className="funnel-done-file" title={fileName}>{fileName}</div> : null}
      {meta ? <div className="funnel-done-meta">{meta}</div> : null}
      {children ? <div className="funnel-done-actions">{children}</div> : null}
    </div>
  );
}
