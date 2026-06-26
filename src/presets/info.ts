// Pedagogical explanations + parameter tips for each preset, keyed by preset name.
export interface PresetTip { param: string; effect: string }
export interface PresetInfo { summary: string; tips: PresetTip[] }

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
}
