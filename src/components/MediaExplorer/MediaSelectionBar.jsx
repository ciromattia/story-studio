import { tagStyle } from './helpers';
import { Button } from '../common/Button';
import { useTranslation } from '../../i18n/I18nContext';

export function MediaSelectionBar({
  selectedCount,
  selectedAudioItems,
  onCopyAudio,
  onCutAudio,
  onOpenAssembly,
  onAddMediaTag,
  bulkTag,
  onBulkTagChange,
  bulkTagOpen,
  onBulkTagOpenChange,
  allTags,
  visibleSelectedItems,
  onClear,
}) {
  const { t } = useTranslation();
  if (selectedCount <= 1) return null;

  function applyBulkTag(e) {
    e.preventDefault();
    const tag = bulkTag.trim();
    if (!tag || selectedCount === 0 || !onAddMediaTag) return;
    for (const item of visibleSelectedItems) {
      onAddMediaTag(item.path, tag);
    }
    onBulkTagChange('');
  }

  return (
    <div className="media-selection-bar">
      <span className="media-selection-count">
        {selectedCount === 1
          ? t('mediaExplorer.selectionBar.selectedCountOne', { count: selectedCount })
          : t('mediaExplorer.selectionBar.selectedCountOther', { count: selectedCount })}
      </span>
      {selectedAudioItems.length > 0 ? (
        <>
          <Button className="media-selection-btn" onClick={onCopyAudio}>
            {selectedAudioItems.length === 1
              ? t('mediaExplorer.selectionBar.copySoundOne', { count: selectedAudioItems.length })
              : t('mediaExplorer.selectionBar.copySoundOther', { count: selectedAudioItems.length })}
          </Button>
          <Button className="media-selection-btn" onClick={onCutAudio}>
            {selectedAudioItems.length === 1
              ? t('mediaExplorer.selectionBar.cutSoundOne', { count: selectedAudioItems.length })
              : t('mediaExplorer.selectionBar.cutSoundOther', { count: selectedAudioItems.length })}
          </Button>
          {selectedAudioItems.length >= 2 && (
            <Button variant="primary" className="media-selection-btn" onClick={onOpenAssembly}>
              {t('mediaExplorer.selectionBar.assembleAudios')}
            </Button>
          )}
        </>
      ) : null}
      {onAddMediaTag ? (
        <div className="media-selection-tag-wrap">
          <form className="media-selection-tag-form" onSubmit={applyBulkTag}>
            <input
              className="media-selection-tag-input"
              value={bulkTag}
              onChange={(e) => onBulkTagChange(e.target.value)}
              onFocus={() => onBulkTagOpenChange(true)}
              onBlur={() => setTimeout(() => onBulkTagOpenChange(false), 150)}
              placeholder={t('mediaExplorer.selectionBar.bulkTagPlaceholder')}
            />
            <Button type="submit" className="media-selection-btn" disabled={!bulkTag.trim()}>
              {t('mediaExplorer.selectionBar.applyButton')}
            </Button>
          </form>
          {bulkTagOpen && allTags.length > 0 && (
            <div className="media-tag-suggestions">
              {allTags
                .filter((t) => !bulkTag || t.toLowerCase().includes(bulkTag.toLowerCase()))
                .map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className="media-tag-suggestion-item"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      for (const item of visibleSelectedItems) onAddMediaTag(item.path, tag);
                      onBulkTagChange('');
                      onBulkTagOpenChange(false);
                    }}
                  >
                    <span className="me-tag-chip" style={tagStyle(tag)}>{tag}</span>
                  </button>
                ))}
            </div>
          )}
        </div>
      ) : null}
      <Button className="media-selection-btn" onClick={onClear}>{t('mediaExplorer.selectionBar.clearButton')}</Button>
    </div>
  );
}
