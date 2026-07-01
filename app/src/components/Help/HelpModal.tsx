import { useT } from '../../i18n'
import styles from './HelpModal.module.css'

interface Props { onClose: () => void }

export function HelpModal({ onClose }: Props) {
  const t = useT()
  const h = t.help

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.title}>{h.title}</span>
          <button className={styles.close} onClick={onClose} title={t.presetInfo.close}>✕</button>
        </div>
        <p className={styles.intro}>{h.intro}</p>
        {h.sections.map(s => (
          <div key={s.title} className={styles.section}>
            <div className={styles.sectionTitle}>{s.title}</div>
            <table className={styles.rows}>
              <tbody>
                {s.rows.map((r, i) => (
                  <tr key={i}>
                    <td className={styles.key}>{r.k}</td>
                    <td className={styles.text}>{r.t}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        <p className={styles.tip}>
          {h.tipPrefix}<b>{h.tipBold1}</b>{h.tipMid}<b>{h.tipBold2}</b>{h.tipSuffix}
        </p>
      </div>
    </div>
  )
}
