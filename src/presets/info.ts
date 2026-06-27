// Pedagogical explanations + parameter tips for each preset, keyed by preset name.
import pyloricSimImg from '../assets/pyloric-sim-traces.svg'
import pyloricLitImg from '../assets/pyloric-lit.png'

export interface PresetTip { param: string; effect: string }
export interface ComparePoint { ok: boolean; text: string }
// Optional side-by-side comparison with a literature figure (e.g. for the STG demo).
export interface PresetComparison {
  intro: string
  simImg: string
  litImg: string
  litCaption: string
  litHref: string
  points: ComparePoint[]
}
export interface PresetInfo { summary: string; tips: PresetTip[]; comparison?: PresetComparison }

export const PRESET_INFO: Record<string, PresetInfo> = {
  'Aktionspotential': {
    summary:
      'Ein einzelnes Neuron (Hodgkin-Huxley-Modell) erzeugt durch einen kurzen Reizpuls ein Aktionspotential. ' +
      'Man sieht die typische Form: schnelle Depolarisation durch Na⁺-Einstrom, Repolarisation durch K⁺-Ausstrom und die ' +
      'anschließende Nachhyperpolarisation. Es gilt das Alles-oder-Nichts-Prinzip.',
    tips: [
      { param: 'I_stim (Reizstärke)', effect: 'Höher = überschwellig → AP. Zu niedrig → kein AP (Schwelle nicht erreicht).' },
      { param: 'Reizdauer', effect: 'Kurz (≈1 ms) → ein einzelnes AP. 0 oder lang (Dauerreiz) → eine Spike-Folge.' },
      { param: 'Reizbeginn', effect: 'Verschiebt den Startzeitpunkt des Reizes auf der Zeitachse.' },
      { param: 'g_Na', effect: 'Kleiner → AP wird flacher oder bleibt aus (wie ein Lokalanästhetikum, das Na⁺-Kanäle blockiert).' },
      { param: 'g_K', effect: 'Größer → schnellere Repolarisation und tiefere Nachhyperpolarisation.' },
      { param: 'Dauer (unten)', effect: '20–30 ms für ein einzelnes AP; größer wählen, um einen Rhythmus zu sehen.' },
    ],
  },
  'Exzitatorische Synapse': {
    summary:
      'Das präsynaptische Neuron feuert und überträgt über eine erregende Synapse einen Strom auf das nachgeschaltete ' +
      'Neuron (EPSP). Reicht die Summe der EPSPs über die Schwelle, feuert das postsynaptische Neuron ebenfalls.',
    tips: [
      { param: 'Leitfähigkeit (Synapse)', effect: 'Höher = stärkerer EPSP. Zu klein → postsynaptisch bleibt unterschwellig (kein AP).' },
      { param: 'Ziel / Eingangsort', effect: 'Dendrit 1 (somanah) wirkt stärker; Dendrit 3 (fern) wird elektrotonisch gedämpft.' },
      { param: 'I_stim (Postsynaptisch)', effect: 'Höher rückt das Neuron näher an die Schwelle → leichter auslösbar.' },
      { param: 'Verzögerung', effect: 'Synaptische Laufzeit zwischen prä- und postsynaptischem Spike.' },
    ],
  },
  'Inhibitorische Synapse': {
    summary:
      'Das antreibende Neuron feuert und hemmt über eine inhibitorische Synapse ein ruhendes Neuron. Man sieht eine nach ' +
      'unten gerichtete Hyperpolarisation (IPSP) – das Gegenteil der erregenden Synapse.',
    tips: [
      { param: 'Leitfähigkeit (Synapse)', effect: 'Höher = stärkere Hyperpolarisation (tieferer IPSP).' },
      { param: 'Typ (Exzitatorisch/Inhibitorisch)', effect: 'Umschalten zeigt direkt den Unterschied: nach oben (EPSP) vs. nach unten (IPSP).' },
      { param: 'I_stim (Gehemmt)', effect: 'Über 0 lässt das Ziel selbst feuern → die Hemmung unterdrückt dann sichtbar sein Feuern.' },
      { param: 'Ziel / Eingangsort', effect: 'Am Eingangsort (Dendrit) ist die Auslenkung größer als am Soma (Kabeldämpfung).' },
    ],
  },
  'Reflexbogen': {
    summary:
      'Dehnungsreflex mit reziproker Hemmung (Sherringtons reziproke Innervation). Eine kurze „Dehnung" erregt das ' +
      'sensorische Neuron (Ia-Afferenz). Dieses erregt direkt den Agonisten (Muskel kontrahiert) UND ein Ia-Interneuron, ' +
      'das den Antagonisten hemmt (er erschlafft). So sieht man das Kernprinzip: Erregung des einen, gleichzeitige ' +
      'Hemmung des Gegenspielers. Modelliert nach Rybak et al. 2006, J Physiol (doi:10.1113/jphysiol.2006.118711).',
    tips: [
      { param: 'I_stim / Reizdauer (Sensorisch)', effect: 'Die „Dehnung". Während des Reizfensters läuft der Reflex; davor/danach ruht der Agonist.' },
      { param: 'I_stim (Antagonist)', effect: 'Sein Grundtonus. Höher → er feuert stärker, die reflektorische Hemmung wird umso deutlicher sichtbar.' },
      { param: 'Leitfähigkeit der Hemm-Synapse', effect: 'Stärker → der Antagonist wird klarer stillgelegt (reziproke Hemmung).' },
      { param: 'Elektroden', effect: 'Auf Agonist und Antagonist setzen: der eine feuert, während der andere gleichzeitig verstummt.' },
    ],
  },
  'Half-Center-Oszillator': {
    summary:
      'Der einfachste Oszillator: zwei Neurone, die sich gegenseitig hemmen. Keines schwingt allein — ' +
      'der Rhythmus entsteht erst aus der Kopplung. Feuert eines, legt es das andere kurz lahm; durch die ' +
      'synaptische Verzögerung pendeln sich beide in Gegenphase ein und feuern abwechselnd. Das ist der ' +
      'Grundbaustein des Schwimmrhythmus, reduziert auf ein einziges Halbzentrum.',
    tips: [
      { param: 'Leitfähigkeit (Hemmung)', effect: 'Zu schwach → kein Takt, beide feuern synchron weiter. Stärker → klarere Alternation.' },
      { param: 'I_stim', effect: 'Der konstante Antrieb. Zu niedrig → kein Feuern; sehr hoch → die Hemmung kann nicht mehr stilllegen, Takt bricht zusammen.' },
      { param: 'Verzögerung', effect: 'Die synaptische Laufzeit stabilisiert die Gegenphase und beeinflusst die Periode.' },
      { param: 'Asymmetrie (I_stim N1 ≠ N2)', effect: 'Ein kleiner Unterschied bricht die Symmetrie, damit eine Seite zuerst loslegt.' },
    ],
  },
  'Schwimmrhythmus': {
    summary:
      'Ein zentraler Mustergenerator (CPG): Über wechselseitige Hemmung zwischen linker und rechter Seite entsteht ein ' +
      'alternierender Rhythmus, wie er der Schwimmbewegung zugrunde liegt.',
    tips: [
      { param: 'I_stim (CPG-Neurone)', effect: 'Treibt die Zellen; höher → schnellerer Rhythmus, zu niedrig → kein Feuern.' },
      { param: 'Leitfähigkeit (inhibitorisch)', effect: 'Stärkere wechselseitige Hemmung → klarere Links-rechts-Alternation.' },
      { param: 'Verzögerung', effect: 'Beeinflusst Periode und Phasenversatz zwischen den Segmenten.' },
      { param: 'Dauer (unten)', effect: 'Groß wählen (z. B. 1000+ ms), um mehrere Rhythmuszyklen zu sehen.' },
    ],
  },
  'Pylorisches Netzwerk': {
    summary:
      'Das pylorische Netzwerk des stomatogastrischen Ganglions der Krabbe (Prinz, Bucher & Marder, Nat Neurosci 2004) – ' +
      'ein klassischer zentraler Mustergenerator. Drei Neuronen vom Prinz-Typ mit je 8 spannungsgesteuerten Strömen und ' +
      'intrazellulärer Ca²⁺-Dynamik: der AB/PD-Schrittmacher (bursted von allein) sowie die Folger LP und PY. Über die ' +
      'volle kanonische 7-Synapsen-Schaltung (glutamaterg + cholinerg) entsteht der typische dreiphasige Rhythmus ' +
      'AB/PD → LP → PY: Der Schrittmacher feuert einen Burst und hemmt dabei LP und PY; danach erholt sich zuerst LP per ' +
      'post-inhibitorischem Rebound (kurzer Burst), LP hemmt PY, und zuletzt feuert PY. Jede Zelle feuert pro Zyklus genau ' +
      'einen klar abgegrenzten Burst. Alle 8 Leitfähigkeiten jedes Neurons und alle Synapsen sind editierbar – ändere sie ' +
      'und beobachte, wie der Rhythmus kippt. Tipp: Soma-Elektroden auf alle drei setzen, um die Sequenz zu sehen.',
    tips: [
      { param: 'g_CaS / g_KCa (AB/PD)', effect: 'Treiben den Schrittmacher-Burst (Ca-Einstrom vs. Ca-aktivierter K-Ausstrom). Kleiner g_CaS → kürzere/keine Bursts; der ganze Rhythmus hängt daran.' },
      { param: 'g_A (LP, PY)', effect: 'Der A-Strom verzögert das Feuern. PY hat viel davon (40) → es feuert zuletzt. Senken → PY feuert früher, die Phasentrennung verschwimmt.' },
      { param: 'g_H (Folger)', effect: 'Treibt die Erholung nach der Hemmung (post-inhibitorischer Rebound). Größer → schnellerer Rebound, frühere Folger-Bursts.' },
      { param: 'g_KCa (LP)', effect: 'Der Ca-aktivierte K-Strom beendet den LP-Burst von selbst (Adaptation). Ohne ihn feuert LP tonisch durch und die Reihenfolge verschwimmt.' },
      { param: 'Cholinerge AB/PD→Folger-Synapse', effect: 'E_syn=−80 mV, langsam: liefert die starke, anhaltende Hemmung, die den sauberen Rebound-Burst der Folger formt. Entfernen → Bursts werden unsauber.' },
      { param: 'ḡ Synapse AB/PD→LP/PY', effect: 'Stärker → Folger werden tiefer/länger stillgelegt. Zu stark → ein Folger verstummt ganz; zu schwach → er feuert tonisch durch.' },
      { param: 'ḡ Synapse LP→PY / PY→LP', effect: 'LP→PY schiebt PY hinter LP; PY→LP-Rückkopplung beendet den LP-Burst mit. Zusammen erzeugen sie die klare Phasentrennung.' },
      { param: 'I_stim (LP, PY)', effect: 'Schwacher tonischer Antrieb (steht für Neuromodulation), der die Folger feuerbereit hält. Auf 0 → Folger feuern unregelmäßiger.' },
      { param: 'Dauer (unten)', effect: 'Der Rhythmus ist langsam (Periode ≈ 1,7 s). 5000–6000 ms wählen, um mehrere Zyklen zu sehen.' },
    ],
    comparison: {
      intro: 'Unsere Simulation (oben) neben einer intrazellulären Ableitung aus der Literatur (unten). ' +
        'Beide zeigen das Membranpotential von AB/PD, LP und PY über mehrere Zyklen.',
      simImg: pyloricSimImg,
      litImg: pyloricLitImg,
      litCaption: 'Literatur: PD/LP/PY intrazellulär (Krabbe). Panel A bei verschiedenen Temperaturen ' +
        '(Spalte 11 °C ist am besten vergleichbar), Panel C die Überlagerung über einen Zyklus. ' +
        'Quelle: Tang LS, Goeritz ML, Caplan JS, Taylor AL, Fisek M, Marder E (2010), PLoS Biology 8(8):e1000469, Lizenz CC BY 4.0.',
      litHref: 'https://journals.plos.org/plosbiology/article?id=10.1371/journal.pbio.1000469',
      points: [
        { ok: true, text: 'Reihenfolge AB/PD → LP → PY: jede Zelle feuert genau einen Burst in ihrer Phase, in jedem Zyklus.' },
        { ok: true, text: 'Alle drei zeigen Bursts mit aufgesetzten Spikes, durch Stillephasen getrennt — LP kurz direkt nach AB/PD, PY länger danach, wie in der Ableitung.' },
        { ok: true, text: 'Die Folger werden während des AB/PD-Bursts gehemmt und feuern per post-inhibitorischem Rebound danach — die cholinerge Komponente (E=−80 mV) formt den sauberen Burst.' },
        { ok: true, text: 'Methodik wie bei Prinz: die Folger-Parameter wurden per systematischer Parametersuche gefunden, mit der vollen kanonischen 7-Synapsen-Topologie.' },
        { ok: false, text: 'Kleiner Unterschied: unsere Periode (~1,7 s) ist etwas länger als die biologischen ~1–1,4 s — unkritisch und temperaturabhängig.' },
      ],
    },
  },
}
