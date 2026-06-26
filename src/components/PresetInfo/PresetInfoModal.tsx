import type { PresetInfo } from '../../presets/info'
import styles from './PresetInfoModal.module.css'

interface Props {
  name: string
  info: PresetInfo
  onClose: () => void
}

function downloadInfo(name: string, info: PresetInfo) {
  const lines = [
    `# ${name}`, '',
    info.summary, '',
    '## Welche Parameter kann ich verändern?', '',
    ...info.tips.map(t => `- **${t.param}**: ${t.effect}`),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${name}.md`
  a.click()
  URL.revokeObjectURL(url)
}

export function PresetInfoModal({ name, info, onClose }: Props) {
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.title}>{name}</span>
          <button className={styles.close} onClick={onClose} title="Schließen">✕</button>
        </div>
        <p className={styles.summary}>{info.summary}</p>
        <div className={styles.tipsTitle}>Was kann ich verändern?</div>
        <ul className={styles.tips}>
          {info.tips.map((t, i) => (
            <li key={i}><strong>{t.param}</strong> — {t.effect}</li>
          ))}
        </ul>
        <button className={styles.download} onClick={() => downloadInfo(name, info)}>
          ⬇ Erläuterung speichern (.md)
        </button>
      </div>
    </div>
  )
}
