import type { Messages } from './en'

// German UI strings. Shape is enforced against the English source dict.
export const de: Messages = {
  lang: { english: 'English', german: 'Deutsch', switchTitle: 'Sprache' },

  header: {
    open: '📂 Öffnen',
    save: '💾 Speichern',
    help: '❓ Hilfe',
    credits: '🙏 Dank',
    namePlaceholder: 'Name der Simulation',
    nameTitle: 'Name der Simulation – klicken zum Umbenennen',
    nameAria: 'Name der Simulation',
  },

  controls: {
    start: '▶ Start',
    live: '🎚 Live',
    liveStop: '■ Live stoppen',
    liveTitle: 'Live-Modus: läuft endlos, Parameter während der Simulation per Regler verändern. Nochmal klicken zum Stoppen.',
    pause: '⏸ Pause',
    resume: '▶ Weiter',
    reset: '⏮ Reset',
    preset: '↺ Preset',
    presetTitle: 'Parameter auf die Werte des geladenen Beispiels zurücksetzen',
    loop: '🔁 Loop',
    loopTitle: 'Simulation in Endlosschleife wiederholen',
    tempo: 'Tempo:',
    tempoTitle: 'Wiedergabe-Tempo (langsam ⟷ schnell)',
    duration: 'Dauer:',
    durationUnit: 'ms',
    time: (t: string) => `t = ${t} ms`,
  },

  voltage: {
    title: 'Spannung (mV)',
    window: 'Fenster',
    csv: '⤓ CSV',
    csvTitle: 'Spannungsverläufe als CSV-Tabelle exportieren (kompletter Lauf)',
    figure: '⤓ Abbildung',
    figureTitle: 'Spannungsverläufe als Abbildung exportieren (schwarz auf weiß, kompletter Lauf)',
    placeholder: 'Klick auf ein Neuron setzt eine Messelektrode',
    expandTitle: 'Detailansicht öffnen',
  },

  graphModal: {
    title: (label: string) => `Messspur — ${label}`,
    hintScope: '🔬 Oszilloskop: eine Reizperiode (Parameter rechts live ändern) · Scroll = Zoom',
    hintNormal: 'Scroll zum Zoomen · Ziehen zum Verschieben',
    yAxis: 'Y-Achse:',
    yMinTitle: 'Y min (mV)',
    yMaxTitle: 'Y max (mV)',
    auto: 'Auto',
    voltagePanel: 'Spannung (mV)',
    currentPanel: 'Strom (nA)',
    timeMs: 'Zeit (ms)',
    legendStim: '— — Injektionsstrom · —— Synaptischer Strom',
    paramTitle: (label: string) => `Parameter — ${label}`,
  },

  help: {
    title: 'Hilfe — So funktioniert BioSim',
    intro:
      'BioSim simuliert Nervenzellen. Du wählst ein Beispiel, startest die Simulation und ' +
      'veränderst Parameter, um zu sehen, wie sich die Aktivität ändert.',
    tipPrefix: '💡 Tipp: Mit ',
    tipBold1: '🎚 Live',
    tipMid: ' + dem Beispiel „Aktionspotential“ am Regler ',
    tipBold2: 'g_Na',
    tipSuffix: ' ziehen — das Aktionspotential wird flacher und verschwindet.',
    sections: [
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
          { k: '▶ Start', t: 'Fester Lauf über die eingestellte „Dauer“.' },
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
    ],
  },

  credits: {
    title: 'Dank & Quellen',
    intro:
      'BioSim steht auf den Schultern anderer. Unser Dank gilt allen, die ihre ' +
      'Modelle, ihren Code und ihre Dokumentation öffentlich zugänglich machen — ' +
      'ohne diese Offenheit gäbe es dieses Projekt nicht.',
    tip:
      'Modellgleichungen und Parameterwerte aus der Fachliteratur sind selbst ' +
      'nicht urheberrechtlich geschützt; die Nennungen oben würdigen die Quellen, ' +
      'die unsere eigene Implementierung reproduziert oder geleitet haben.',
    dedicationPrefix: 'Gewidmet ',
    dedicationName: 'Stefan Bergdoll',
    dedicationSuffix:
      ', der mit dem ursprünglichen BIOSIM die Grundlage für meine Simulationsarbeiten ' +
      'gelegt und mir später den originalen Quellcode anvertraut hat. Ohne ihn gäbe es ' +
      'dieses Projekt nicht — und nicht einmal seinen Namen.',
    sectionOrigin: 'Namensgeber & Vorläufer',
    sectionCode: 'Quelloffene Code-Referenzen',
    sectionModels: 'Zugrunde liegende wissenschaftliche Modelle',
    bergdollNote:
      'Das ursprüngliche BIOSIM (© 1990–1993, BASF-AG Ludwigshafen) — ein neuronaler ' +
      'Simulator für Windows. Sein Programm war Namensgeber und Inspiration für dieses ' +
      'Projekt; inzwischen hat er auch den ursprünglichen Quellcode zur Verfügung gestellt.',
    pyloricNote: 'MIT-Lizenz. Teile der STG-Integration sind an dieser frei verfügbaren Implementierung orientiert.',
    xolotlNote: 'Konzeptionelle Referenz für die Burst-Neuron- und Half-Center-Beispiele. Kein Code übernommen — Dank für das offene Vorbild.',
    prinzNote: 'Similar network activity from disparate circuit parameters. Nature Neuroscience 7(12), 1345–1352.',
    gorurNote: 'Xolotl: An intuitive and approachable neuron and network simulator. Frontiers in Neuroinformatics 12, 87.',
    goncalvesNote: 'Training deep neural density estimators to identify mechanistic models of neural dynamics. eLife 9, e56261.',
  },

  params: {
    mode: 'Modus',
    modePresentation: 'Präsentation',
    modeEditor: 'Editor',
    modeStudent: 'Schüler',
    tools: 'Werkzeuge',
    examples: 'Beispiele',
    presetInfoTitle: 'Erläuterung & Parameter-Tipps anzeigen',
    parametersFor: (model: string) => `Parameter — ${model}`,
    modelLIF: 'LIF',
    modelGraded: 'Nicht-spikend',
    modelHH: 'HH',
    modelSTG: 'STG (Prinz)',
    modelOptHH: 'Spikend (HH)',
    modelOptLIF: 'Spikend (LIF)',
    modelOptSTG: 'STG (Prinz)',
    modelOptGraded: 'Nicht-spikend',
    electrodeHint: '💡 Klicke auf Soma oder Dendrit im Neuron um eine Messelektrode zu setzen.',
    synapse: 'Synapse',
    savedStates: 'Gespeicherte Zustände',
    otherGroup: 'Sonstige (ohne Preset)',
    saveCurrent: '+ Aktuellen Zustand speichern',
    importFileBtn: '⬆ Datei importieren',
    noSaved: 'keine gespeicherten Zustände',
    namePrompt: 'Name für diesen Zustand:',
    overwriteConfirm: (name: string) => `„${name}" existiert bereits. Überschreiben?`,
    deleteConfirm: (name: string) => `„${name}" löschen?`,
    exportTitle: 'Als Datei exportieren',
    deleteTitle: 'Löschen',
    bundledTitle: 'Mitgeliefertes Beispiel (schreibgeschützt)',
    loadSetupTitle: 'Diesen Zustand laden',
  },

  stg: {
    conductances: 'Leitfähigkeiten',
    driveNoise: 'Antrieb & Rauschen',
    noiseLabel: 'Rauschen σ',
  },

  lif: {
    threshold: 'Schwelle (mV)',
    stimulus: 'Reiz',
    neuronParams: 'Neuron-Parameter',
  },

  hh: {
    stimulus: 'Reiz',
    stimSite: 'Reizort',
    neuronParams: 'Neuron-Parameter',
    gCore: 'g_core (axial)',
  },

  stim: {
    type: 'Reiztyp',
    pulse: 'Puls',
    ramp: 'Rampe',
    onset: 'Reizbeginn (ms)',
    plateau: 'Plateaudauer (ms, 0=Dauer)',
    stimDuration: 'Reizdauer (ms, 0=Dauer)',
    period: 'Wiederholung Periode (ms, 0=einmalig)',
    rampTime: 'Rampenzeit (ms)',
    velocity: 'Geschwindigkeit (× I)',
    acceleration: 'Beschleunigung (× I)',
  },

  syn: {
    mechanism: 'Mechanismus',
    spikeDriven: 'Spike-getrieben (EPSC/IPSC)',
    graded: 'Graduiert (STG, chemisch)',
    transmitter: 'Transmitter',
    glut: 'Glutamaterg (E=−70 mV, schnell)',
    chol: 'Cholinerg (E=−80 mV, langsam)',
    gradedConductance: 'Synaptische Leitfähigkeit ḡ (nS)',
    type: 'Typ',
    excitatory: 'Exzitatorisch',
    inhibitory: 'Inhibitorisch',
    target: 'Ziel (Eingangsort)',
    conductance: 'Leitfähigkeit (nS)',
    delay: 'Verzögerung (ms)',
    dend1: 'Dendrit 1',
    dend2: 'Dendrit 2',
    dend3: 'Dendrit 3',
    soma: 'Soma',
  },

  editor: {
    toolSelect: '🔒 Sperre',
    toolSynapse: '🔗 Synapse',
    toolSpiking: '⚡ Spikend',
    toolNonspiking: '○ Nicht-spikend',
    toolAfferent: '▷ Afferenz',
    delete: '🗑 Löschen',
    deleteTitle: 'Ausgewähltes Neuron oder Synapse löschen',
    model: 'Modell:',
    hint:
      'Platzier-Werkzeug → Klick auf freies Feld setzt ein Neuron. Synapse: ' +
      'Quell-Neuron, dann Ziel-Neuron klicken. Sperre: kein Platzieren — ' +
      'auswählen, verschieben, Elektroden setzen.',
  },

  canvas: {
    connectHint: 'Ziel-Neuron klicken um Synapse zu verbinden',
    neuron: (n: number) => `Neuron ${n}`,
    zoomOut: 'Verkleinern',
    zoom100: '100 %',
    zoomIn: 'Vergrößern',
  },

  errorBoundary: {
    title: 'Etwas ist schiefgelaufen',
    body: 'Die Darstellung hat einen Fehler ausgelöst. Dein Netzwerk ist noch da — du kannst die Simulation zurücksetzen und weiterarbeiten.',
    recover: 'Zurücksetzen & weiter',
    reload: 'Seite neu laden',
  },

  confirm: {
    clearCanvas: 'Canvas für den Editor leeren? (Abbrechen behält das aktuelle Netz)',
  },

  fileError: {
    invalidJson: 'Ungültiges JSON',
    unknownVersion: (v: unknown) => `Unbekannte Version: ${v}`,
    invalidFormat: 'Ungültiges Netzwerkformat',
    cancelled: 'Abgebrochen',
    noFile: 'Keine Datei ausgewählt',
  },

  presetInfo: {
    close: 'Schließen',
    whatCanIChange: 'Was kann ich verändern?',
    compareTitle: 'Vergleich mit der Literatur',
    fig1: '① BioSim — unsere Simulation (validierter Parametersatz, mit Rauschen)',
    fig2Prefix: '② Referenzsimulator (mackelab/pyloric) — ',
    fig3Suffix: 'Originalartikel ↗',
    citeTitle: 'Quellen & Zitierung',
    requested: 'von den Autoren erbeten',
    copyBibtex: 'BibTeX kopieren',
    download: '⬇ Erläuterung speichern (.md)',
    mdWhatCanChange: 'Welche Parameter kann ich verändern?',
    mdComparison: 'Vergleich mit der Literatur',
    mdSources: 'Quellen & Zitierung',
    mdRequested: ' (von den Autoren erbeten)',
    simImgAlt: 'BioSim-Simulation der pylorischen Spuren',
    refImgAlt: 'Referenzsimulator mackelab/pyloric',
    litImgAlt: 'Literatur: intrazelluläre Ableitung PD/LP/PY',
  },
}
