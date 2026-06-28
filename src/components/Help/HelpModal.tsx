import styles from './HelpModal.module.css'

interface Props { onClose: () => void }

interface Row { k: string; t: string }
interface Section { title: string; rows: Row[] }

const SECTIONS: Section[] = [
  {
    title: 'Loslegen',
    rows: [
      { k: 'Beispiele', t: 'Links ein Modell wählen, dann unten ▶ Start drücken.' },
      { k: 'ⓘ', t: 'Neben jedem Beispiel: kurze Erklärung + welche Parameter sich lohnen.' },
      { k: 'Modi', t: 'Präsentation (ansehen) · Editor (eigenes Netz bauen) · Schüler (vereinfacht).' },
    ],
  },
  {
    title: 'Steuerung (untere Leiste)',
    rows: [
      { k: '▶ Start', t: 'Fester Lauf über die eingestellte „Dauer".' },
      { k: '🎚 Live', t: 'Endlos-Lauf: Regler WÄHREND der Simulation ziehen und sofort die Wirkung sehen. Nochmal klicken = stoppen.' },
      { k: '⏸ / ⏮', t: 'Pause / Reset (zurück auf Anfang).' },
      { k: '↺ Preset', t: 'Parameter auf die Werte des Beispiels zurücksetzen.' },
      { k: '🔁 Loop', t: 'Lauf automatisch wiederholen.' },
      { k: 'Tempo', t: 'Wiedergabe schneller oder langsamer.' },
    ],
  },
  {
    title: 'Parameter ändern (links)',
    rows: [
      { k: 'Auswählen', t: 'Ein Neuron oder eine Synapse anklicken → die Regler erscheinen.' },
      { k: 'Reiz / Neuron', t: 'Die Werte sind in Abschnitte getrennt (z. B. Reiz vs. Neuron-Parameter).' },
      { k: 'Regler + Feld', t: 'Schieber zum schnellen Ausprobieren, Zahlenfeld für exakte Werte.' },
    ],
  },
  {
    title: 'Netzwerk-Fenster (Mitte)',
    rows: [
      { k: 'Aktivität', t: 'Feuert ein Neuron, leuchtet es kurz auf.' },
      { k: 'Symbole', t: 'Goldener Pfeil = Reizstrom · farbiger Punkt = Messelektrode.' },
      { k: 'Zoom', t: 'Unten rechts − / + : Netz vergrößern oder verkleinern.' },
    ],
  },
  {
    title: 'Spannungskurven (rechts)',
    rows: [
      { k: 'Elektrode', t: 'Auf Soma oder Dendrit eines Neurons klicken setzt/entfernt eine Messelektrode (eine Kurve je Elektrode).' },
      { k: 'Fenster', t: 'Stellt den sichtbaren Zeitausschnitt ein (z. B. 100 ms … 5 s).' },
      { k: '⛶ Detailsicht', t: 'Öffnet ein großes Diagramm des Neurons.' },
    ],
  },
  {
    title: 'Detailsicht (⛶)',
    rows: [
      { k: 'Zoom', t: 'In die Kurve hinein- und herauszoomen, um Spikes genau anzusehen.' },
      { k: 'Achsen', t: 'Spannungsachse lässt sich einstellen; Werte direkt ablesen.' },
    ],
  },
]

export function HelpModal({ onClose }: Props) {
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.title}>Hilfe — So funktioniert BioSim</span>
          <button className={styles.close} onClick={onClose} title="Schließen">✕</button>
        </div>
        <p className={styles.intro}>
          BioSim simuliert Nervenzellen. Du wählst ein Beispiel, startest die Simulation und
          veränderst Parameter, um zu sehen, wie sich die Aktivität ändert.
        </p>
        {SECTIONS.map(s => (
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
        <p className={styles.tip}>💡 Tipp: Mit <b>🎚 Live</b> + dem Beispiel „Aktionspotential" am Regler <b>g_Na</b> ziehen — das Aktionspotential wird flacher und verschwindet.</p>
      </div>
    </div>
  )
}
