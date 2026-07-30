import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Button } from '../../components/common/Button';
import { Toggle } from '../../components/common/Toggle';
import { pickComfyWorkflowApiJson, pickComfyWorkflowConfigJson } from '../../hooks/useFileDialog';
import { isTauriRuntime } from '../../utils/tauriRuntime';
import { useTranslation } from '../../i18n/I18nContext';

export function AiImagesSection({ className, sectionRef, sdSettings, onUpdateSdSettings }) {
  const { t } = useTranslation();
  const [sdProbe, setSdProbe] = useState({ state: 'idle', message: '' });
  const [sdWorkflows, setSdWorkflows] = useState([]);
  const [importApiPath, setImportApiPath] = useState(null);
  const [importConfigPath, setImportConfigPath] = useState(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (!isTauriRuntime()) return;

    invoke('comfyui_list_workflows')
      .then(setSdWorkflows)
      .catch(() => {});
  }, []);

  async function handleTestSd() {
    const launching = sdSettings?.autoStart && sdSettings?.launcherPath;
    setSdProbe({
      state: 'loading',
      message: launching ? t('options.aiImages.launchingMessage') : t('options.aiImages.connectingMessage'),
    });
    try {
      await invoke('comfyui_check', { settings: sdSettings });
      setSdProbe({ state: 'ok', message: t('options.aiImages.readyMessage') });
    } catch (e) {
      setSdProbe({ state: 'error', message: String(e) });
    }
  }

  async function handlePickApiJson() {
    const result = await pickComfyWorkflowApiJson();
    if (result) setImportApiPath(result);
  }

  async function handlePickConfigJson() {
    const result = await pickComfyWorkflowConfigJson();
    if (result) setImportConfigPath(result);
  }

  async function handleImportWorkflow() {
    if (!importApiPath || !importConfigPath) return;
    setImporting(true);
    try {
      const wf = await invoke('comfyui_import_workflow', {
        apiJsonPath: importApiPath,
        configJsonPath: importConfigPath,
      });
      setSdWorkflows(prev => [...prev.filter(w => w.id !== wf.id), wf]);
      setImportApiPath(null);
      setImportConfigPath(null);
    } catch (e) {
      setSdProbe({ state: 'error', message: t('options.aiImages.importFailedMessage', { error: e }) });
    } finally {
      setImporting(false);
    }
  }

  async function handleDeleteWorkflow(workflowId) {
    try {
      await invoke('comfyui_delete_workflow', { workflowId });
      setSdWorkflows(prev => prev.filter(w => w.id !== workflowId));
    } catch (e) {
      setSdProbe({ state: 'error', message: t('options.aiImages.deleteFailedMessage', { error: e }) });
    }
  }

  return (
    <section id="comfyui" className={className} ref={sectionRef}>
      <div className="opts-card-title">{t('options.aiImages.title')}</div>
      <div className="opts-row">
        <div className="opts-row-info">
          <div className="opts-row-label">{t('options.aiImages.enableLabel')}</div>
          <div className="opts-row-sub">
            {t('options.aiImages.enableSub')}
          </div>
        </div>
        <Toggle on={sdSettings?.aiImageGen} onChange={(v) => onUpdateSdSettings?.({ aiImageGen: v })} />
      </div>

      {sdSettings?.aiImageGen && (
        <div className="xtts-settings">
          <div className="xtts-grid">
            <label className="xtts-label">
              {t('options.aiImages.serverUrlLabel')}
              <input
                className="xtts-input"
                value={sdSettings?.serverUrl ?? ''}
                onChange={(e) => onUpdateSdSettings?.({ serverUrl: e.target.value })}
                placeholder={t('options.aiImages.serverUrlPlaceholder')}
              />
            </label>
            <label className="xtts-label">
              {t('options.aiImages.launcherPathLabel')}
              <input
                className="xtts-input"
                value={sdSettings?.launcherPath ?? ''}
                onChange={(e) => onUpdateSdSettings?.({ launcherPath: e.target.value })}
                placeholder={t('options.aiImages.launcherPathPlaceholder')}
              />
            </label>
          </div>

          <div className="opts-row opts-row--pt">
            <div className="opts-row-info">
              <div className="opts-row-label">{t('options.aiImages.autoStartLabel')}</div>
              <div className="opts-row-sub">
                {t('options.aiImages.autoStartSub')}
              </div>
            </div>
            <Toggle on={sdSettings?.autoStart} onChange={(v) => onUpdateSdSettings?.({ autoStart: v })} />
          </div>

          <div className="xtts-actions">
            <Button onClick={handleTestSd} disabled={sdProbe.state === 'loading'}>
              {sdProbe.state === 'loading'
                ? (sdSettings?.autoStart && sdSettings?.launcherPath ? t('options.aiImages.launchingButton') : t('options.aiImages.testingButton'))
                : t('options.aiImages.testButton')}
            </Button>
          </div>

          {sdProbe.state !== 'idle' && (
            <div className={`info-box ${sdProbe.state === 'error' ? 'warn' : ''}`}>
              {sdProbe.message}
            </div>
          )}

          {/* Gestion des workflows */}
          <div className="sd-workflows-section">
            <div className="opts-row-label" style={{ marginBottom: 8 }}>{t('options.aiImages.workflowsTitle')}</div>
            {sdWorkflows.length === 0 ? (
              <div className="opts-row-sub">{t('options.aiImages.noWorkflows')}</div>
            ) : (
              <div className="sd-workflow-list">
                {sdWorkflows.map(wf => (
                  <div key={wf.id} className="sd-workflow-item">
                    <div>
                      <span className="sd-workflow-item-name">{wf.name}</span>
                      {!wf.isCustom && <span className="sd-workflow-item-tag">{t('options.aiImages.builtInTag')}</span>}
                    </div>
                    {wf.isCustom && (
                      <Button
                        size="sm"
                        onClick={() => handleDeleteWorkflow(wf.id)}
                      >
                        {t('options.aiImages.deleteButton')}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="sd-import-section">
              <div className="opts-row-label" style={{ marginBottom: 6 }}>{t('options.aiImages.importTitle')}</div>
              <div className="sd-import-row">
                <Button size="sm" onClick={handlePickApiJson}>
                  {importApiPath ? t('options.aiImages.apiJsonChosenButton') : t('options.aiImages.chooseApiJsonButton')}
                </Button>
                <Button size="sm" onClick={handlePickConfigJson}>
                  {importConfigPath ? t('options.aiImages.configJsonChosenButton') : t('options.aiImages.chooseConfigJsonButton')}
                </Button>
                <Button
                  size="sm"
                  variant="primary-violet"
                  onClick={handleImportWorkflow}
                  disabled={!importApiPath || !importConfigPath || importing}
                >
                  {importing ? t('options.aiImages.importingButton') : t('options.aiImages.importButton')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
