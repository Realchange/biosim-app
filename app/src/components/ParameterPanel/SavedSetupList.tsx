import { useState } from 'react'
import { PRESETS, BUNDLED_SETUPS } from '@biosim/core'
import { useNetworkStore } from '../../store/networkStore'
import { useT } from '../../i18n'
import { usePresetInfo } from '../../presets/info'
import { setupsForPreset, otherSetups, findUserSetup } from '../../utils/savedSetups'
import { CancelledError } from '../../utils/fileIO'
import styles from './SavedSetupList.module.css'

export function SavedSetupList({ onShowInfo }: { onShowInfo: (presetName: string) => void }) {
  const t = useT()
  const PRESET_INFO = usePresetInfo()
  const {
    userSetups, currentPresetName, loadNetwork, loadSetup, deleteSetup, exportSetup, importSetup, saveCurrentSetup,
  } = useNetworkStore()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [showInfo, setShowInfo] = useState(false)

  const presetNames = PRESETS.map(p => p.name)
  const all = [...BUNDLED_SETUPS, ...userSetups]
  const toggle = (key: string) => setExpanded(prev => {
    const next = new Set(prev)
    next.has(key) ? next.delete(key) : next.add(key)
    return next
  })

  const onSave = () => {
    const name = window.prompt(t.params.namePrompt)?.trim()
    if (!name) return
    const dup = findUserSetup(name, currentPresetName)
    if (dup) {
      if (!window.confirm(t.params.overwriteConfirm(name))) return
      deleteSetup(dup.id)
    }
    saveCurrentSetup(name)
  }

  const setupRow = (s: typeof all[number]) => (
    <div key={s.id} className={styles.setupRow}>
      <button className={styles.setupButton} title={t.params.loadSetupTitle} onClick={() => loadSetup(s.id)}>
        <span aria-hidden="true">▶ </span>{s.name}
      </button>
      {s.source === 'bundled'
        ? <span className={styles.lock} title={t.params.bundledTitle}>🔒</span>
        : <>
            <button className={styles.iconBtn} title={t.params.exportTitle} onClick={() => exportSetup(s.id)}>⬇</button>
            <button className={styles.iconBtn} title={t.params.deleteTitle}
              onClick={() => { if (window.confirm(t.params.deleteConfirm(s.name))) deleteSetup(s.id) }}>✗</button>
          </>}
    </div>
  )

  const other = otherSetups(all, presetNames)

  return (
    <div>
      {PRESETS.map(preset => {
        const setups = setupsForPreset(all, preset.name)
        const open = expanded.has(preset.name)
        return (
          <div key={preset.name} className={styles.group}>
            <div className={styles.presetRow}>
              <button className={styles.chevron} onClick={() => toggle(preset.name)}
                aria-label={preset.name}>{open ? '▾' : '▸'}</button>
              <button className={styles.presetButton} onClick={() => { toggle(preset.name); loadNetwork(preset.network) }}>
                {PRESET_INFO[preset.name]?.name ?? preset.name}
              </button>
              {PRESET_INFO[preset.name] && (
                <button className={styles.infoButton} title={t.params.presetInfoTitle}
                  onClick={() => onShowInfo(preset.name)}>ⓘ</button>
              )}
            </div>
            {open && (setups.length > 0
              ? setups.map(setupRow)
              : <div className={styles.empty}>{t.params.noSaved}</div>)}
          </div>
        )
      })}

      {other.length > 0 && (
        <div className={styles.group}>
          <div className={styles.presetRow}>
            <button className={styles.chevron} onClick={() => toggle('__other__')}>
              {expanded.has('__other__') ? '▾' : '▸'}</button>
            <span className={styles.presetButton}>{t.params.otherGroup}</span>
          </div>
          {expanded.has('__other__') && other.map(setupRow)}
        </div>
      )}

      <div className={styles.actions}>
        <div className={styles.actionsHead}>
          <span className={styles.actionsLabel}>{t.params.savedStates}</span>
          <button className={styles.infoButton} title={t.params.savedInfoBtnTitle}
            onClick={() => setShowInfo(true)}>ⓘ</button>
        </div>
        <button className={styles.actionBtn} onClick={onSave}>{t.params.saveCurrent}</button>
        <button className={styles.actionBtn} onClick={async () => {
          try { await importSetup() } catch (e) {
            if (!(e instanceof CancelledError)) alert((e as Error).message)
          }
        }}>{t.params.importFileBtn}</button>
      </div>

      {showInfo && (
        <div className={styles.overlay} onClick={() => setShowInfo(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>{t.params.savedInfoTitle}</span>
              <button className={styles.close} title={t.params.savedInfoClose}
                onClick={() => setShowInfo(false)}>✕</button>
            </div>
            <p className={styles.infoIntro}>{t.params.savedInfoIntro}</p>
            <div className={styles.infoBlock}>
              <div className={styles.infoLabel}>{t.params.savedInfoLocalLabel}</div>
              <p className={styles.infoBody}>{t.params.savedInfoLocalBody}</p>
            </div>
            <div className={styles.infoBlock}>
              <div className={styles.infoLabel}>{t.params.savedInfoFileLabel}</div>
              <p className={styles.infoBody}>{t.params.savedInfoFileBody}</p>
            </div>
            <div className={styles.infoBlock}>
              <div className={styles.infoLabel}>{t.params.savedInfoBundledLabel}</div>
              <p className={styles.infoBody}>{t.params.savedInfoBundledBody}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
