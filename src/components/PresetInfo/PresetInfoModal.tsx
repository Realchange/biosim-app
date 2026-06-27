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
    ...(info.comparison ? [
      '', '## Vergleich mit der Literatur', '',
      info.comparison.intro, '',
      ...info.comparison.points.map(p => `- ${p.ok ? '✓' : '≈'} ${p.text}`),
      '', info.comparison.litCaption, info.comparison.litHref,
    ] : []),
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

        {info.comparison && (
          <div className={styles.compare}>
            <div className={styles.tipsTitle}>Vergleich mit der Literatur</div>
            <p className={styles.compareIntro}>{info.comparison.intro}</p>
            <figure className={styles.figure}>
              <img src={info.comparison.simImg} alt="BioSim-Simulation der pylorischen Spuren" />
              <figcaption>BioSim — Simulation (Prinz-Modell)</figcaption>
            </figure>
            <figure className={styles.figure}>
              <img src={info.comparison.litImg} alt="Literatur: intrazelluläre Ableitung PD/LP/PY" />
              <figcaption>
                {info.comparison.litCaption}{' '}
                <a href={info.comparison.litHref} target="_blank" rel="noopener noreferrer">Originalartikel ↗</a>
              </figcaption>
            </figure>
            <ul className={styles.comparePoints}>
              {info.comparison.points.map((p, i) => (
                <li key={i} className={p.ok ? styles.ptOk : styles.ptDiff}>
                  <span className={styles.ptMark}>{p.ok ? '✓' : '≈'}</span> {p.text}
                </li>
              ))}
            </ul>
          </div>
        )}

        <button className={styles.download} onClick={() => downloadInfo(name, info)}>
          ⬇ Erläuterung speichern (.md)
        </button>
      </div>
    </div>
  )
}
