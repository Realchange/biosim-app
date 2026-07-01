import { useT } from '../../i18n'
import styles from './CreditsModal.module.css'

interface Props { onClose: () => void }

export function CreditsModal({ onClose }: Props) {
  const t = useT()
  const c = t.credits

  interface Entry { name: string; note: string; href?: string }
  interface Section { title: string; entries: Entry[] }

  const sections: Section[] = [
    {
      title: c.sectionOrigin,
      entries: [{ name: 'Stefan Bergdoll', note: c.bergdollNote }],
    },
    {
      title: c.sectionCode,
      entries: [
        { name: 'mackelab/pyloric', note: c.pyloricNote, href: 'https://github.com/mackelab/pyloric' },
        { name: 'xolotl (Gorur-Shandilya, Hoyland & Marder)', note: c.xolotlNote, href: 'https://github.com/sg-s/xolotl' },
      ],
    },
    {
      title: c.sectionModels,
      entries: [
        { name: 'Prinz, Bucher & Marder (2004)', note: c.prinzNote },
        { name: 'Gorur-Shandilya, Hoyland & Marder (2018)', note: c.gorurNote },
        { name: 'Gonçalves et al. (2020)', note: c.goncalvesNote },
      ],
    },
  ]

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.title}>{c.title}</span>
          <button className={styles.close} onClick={onClose} title={t.presetInfo.close}>✕</button>
        </div>
        <p className={styles.intro}>{c.intro}</p>
        {sections.map(s => (
          <div key={s.title} className={styles.section}>
            <div className={styles.sectionTitle}>{s.title}</div>
            {s.entries.map((e, i) => (
              <div key={i} className={styles.entry}>
                <div className={styles.name}>
                  {e.href
                    ? <a className={styles.link} href={e.href} target="_blank" rel="noopener noreferrer">{e.name} ↗</a>
                    : e.name}
                </div>
                <div className={styles.note}>{e.note}</div>
              </div>
            ))}
          </div>
        ))}
        <p className={styles.dedication}>
          {c.dedicationPrefix}<b>{c.dedicationName}</b>{c.dedicationSuffix}
        </p>
        <p className={styles.tip}>{c.tip}</p>
      </div>
    </div>
  )
}
