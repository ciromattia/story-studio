import { useTranslation } from '../../../i18n/I18nContext';

export function DiagramLegend({ returnEdges, homeEdges, afterEndEdges, referenceEdges }) {
  const { t } = useTranslation();
  return (
    <div className="fd-stage-legend" aria-label={t('diagram.legend.ariaLabel')}>
      <div className="fd-complete-legend-item">
        <span className="fd-complete-legend-line" />
        <span>{t('diagram.legend.mainStructure')}</span>
      </div>
      {returnEdges.length > 0 ? (
        <div className="fd-complete-legend-item">
          <span className="fd-complete-legend-line fd-complete-legend-line--return" />
          <span>{t('diagram.legend.returns')}</span>
        </div>
      ) : null}
      {homeEdges.length > 0 ? (
        <div className="fd-complete-legend-item">
          <span className="fd-complete-legend-line fd-complete-legend-line--home" />
          <span>{t('diagram.legend.modifiedReturns')}</span>
        </div>
      ) : null}
      {afterEndEdges.length > 0 ? (
        <div className="fd-complete-legend-item">
          <span className="fd-complete-legend-line fd-complete-legend-line--after-end" />
          <span>{t('diagram.legend.returns')}</span>
        </div>
      ) : null}
      {referenceEdges.length > 0 ? (
        <div className="fd-complete-legend-item">
          <span className="fd-complete-legend-line fd-complete-legend-line--reference" />
          <span>{t('diagram.legend.links')}</span>
        </div>
      ) : null}
    </div>
  );
}
