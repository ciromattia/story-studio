import { Button } from '../common/Button';
import { useTranslation } from '../../i18n/I18nContext';

export function MediaToolResultBanner({
  result,
  unavailableReason = '',
  onFinish,
}) {
  const { t } = useTranslation();
  if (!result) return null;
  const createdCount = result.createdPaths?.length ?? 0;
  const defaultMessage = createdCount === 1
    ? t('mediaExplorer.toolResult.singleFileSelectedMessage')
    : t('mediaExplorer.toolResult.multipleFilesSelectedMessage', { count: createdCount });

  return (
    <div className="media-tool-result" role="status" aria-live="polite">
      <Button
        variant="icon"
        className="media-tool-result-close"
        onClick={onFinish}
        aria-label={t('mediaExplorer.toolResult.closeNotificationAria')}
        title={t('mediaExplorer.toolResult.closeTitle')}
      >×</Button>
      <div className="media-tool-result-copy">
        <strong>{result.projectApplied ? t('mediaExplorer.toolResult.projectUpdatedTitle') : t('mediaExplorer.toolResult.filesCreatedTitle')}</strong>
        <span>{result.message || defaultMessage}</span>
        {unavailableReason ? (
          <small>{unavailableReason}{result.projectApplied ? '' : t('mediaExplorer.toolResult.filesRemainAvailableSuffix')}</small>
        ) : null}
      </div>
    </div>
  );
}
