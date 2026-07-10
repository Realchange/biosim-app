// English UI strings — the source-of-truth shape for the message dictionary.
// de.ts must match this shape exactly (enforced by `Messages` typing).
export const en = {
  lang: { english: 'English', german: 'Deutsch', switchTitle: 'Language' },

  header: {
    open: '📂 Open',
    save: '💾 Save',
    help: '❓ Help',
    credits: '🙏 Thanks',
    namePlaceholder: 'Simulation name',
    nameTitle: 'Simulation name – click to rename',
    nameAria: 'Simulation name',
  },

  controls: {
    start: '▶ Start',
    live: '🎚 Live',
    liveStop: '■ Stop live',
    liveTitle: 'Live mode: runs forever, drag parameters during the simulation. Click again to stop.',
    pause: '⏸ Pause',
    resume: '▶ Resume',
    reset: '⏮ Reset',
    preset: '↺ Preset',
    presetTitle: 'Reset parameters to the loaded example’s values',
    loop: '🔁 Loop',
    loopTitle: 'Repeat the simulation in an endless loop',
    tempo: 'Speed:',
    tempoTitle: 'Playback speed (slow ⟷ fast)',
    duration: 'Duration:',
    durationUnit: 'ms',
    time: (t: string) => `t = ${t} ms`,
  },

  voltage: {
    title: 'Voltage (mV)',
    window: 'Window',
    csv: '⤓ CSV',
    csvTitle: 'Export voltage traces as a CSV table (full run)',
    figure: '⤓ Figure',
    figureTitle: 'Export voltage traces as a figure (black on white, full run)',
    placeholder: 'Click a neuron to place a recording electrode',
    expandTitle: 'Open detail view',
  },

  graphModal: {
    title: (label: string) => `Recording — ${label}`,
    hintScope: '🔬 Oscilloscope: one stimulus period (change parameters live on the right) · scroll = zoom',
    hintNormal: 'Scroll to zoom · drag to pan',
    yAxis: 'Y axis:',
    yMinTitle: 'Y min (mV)',
    yMaxTitle: 'Y max (mV)',
    auto: 'Auto',
    voltagePanel: 'Voltage (mV)',
    currentPanel: 'Current (nA)',
    timeMs: 'Time (ms)',
    legendStim: '— — injected current · —— synaptic current',
    paramTitle: (label: string) => `Parameters — ${label}`,
  },

  help: {
    title: 'Help — How BioSim works',
    intro:
      'BioSim simulates nerve cells. You pick an example, start the simulation and ' +
      'change parameters to see how the activity changes.',
    tipPrefix: '💡 Tip: with ',
    tipBold1: '🎚 Live',
    tipMid: ' + the example “Action potential” drag the slider ',
    tipBold2: 'g_Na',
    tipSuffix: ' — the action potential flattens and disappears.',
    sections: [
      {
        title: 'Getting started',
        rows: [
          { k: 'Examples', t: 'Pick a model on the left, then press ▶ Start at the bottom.' },
          { k: 'ⓘ', t: 'Next to each example: a short explanation + which parameters are worth changing.' },
          { k: 'Modes', t: 'Presentation (watch) · Editor (build your own network) · Student (simplified).' },
        ],
      },
      {
        title: 'Controls (bottom bar)',
        rows: [
          { k: '▶ Start', t: 'Fixed run over the set “Duration”.' },
          { k: '🎚 Live', t: 'Endless run: drag sliders DURING the simulation and see the effect at once. Click again to stop.' },
          { k: '⏸ / ⏮', t: 'Pause / Reset (back to the start).' },
          { k: '↺ Preset', t: 'Reset parameters to the example’s values.' },
          { k: '🔁 Loop', t: 'Repeat the run automatically.' },
          { k: 'Speed', t: 'Play back faster or slower.' },
        ],
      },
      {
        title: 'Changing parameters (left)',
        rows: [
          { k: 'Select', t: 'Click a neuron or a synapse → the sliders appear.' },
          { k: 'Stimulus / neuron', t: 'Values are split into sections (e.g. stimulus vs. neuron parameters).' },
          { k: 'Slider + field', t: 'Slider for quick exploring, numeric field for exact values.' },
        ],
      },
      {
        title: 'Network window (centre)',
        rows: [
          { k: 'Activity', t: 'When a neuron fires, it lights up briefly.' },
          { k: 'Symbols', t: 'Gold arrow = stimulus current · coloured dot = recording electrode.' },
          { k: 'Zoom', t: 'Bottom right − / + : enlarge or shrink the network.' },
        ],
      },
      {
        title: 'Voltage traces (right)',
        rows: [
          { k: 'Electrode', t: 'Clicking the soma or a dendrite of a neuron sets/removes a recording electrode (one trace per electrode).' },
          { k: 'Window', t: 'Sets the visible time span (e.g. 100 ms … 5 s).' },
          { k: '⛶ Detail view', t: 'Opens a large diagram of the neuron.' },
        ],
      },
      {
        title: 'Detail view (⛶)',
        rows: [
          { k: 'Zoom', t: 'Zoom in and out of the trace to inspect spikes closely.' },
          { k: 'Axes', t: 'The voltage axis is adjustable; read values directly.' },
        ],
      },
    ],
  },

  credits: {
    title: 'Thanks & Sources',
    intro:
      'BioSim stands on the shoulders of others. Our thanks go to everyone who makes ' +
      'their models, code and documentation publicly available — without that openness ' +
      'this project would not exist.',
    tip:
      'Model equations and parameter values from the scientific literature are not ' +
      'themselves copyrightable; the attributions above acknowledge the sources our ' +
      'own implementation reproduces or was guided by.',
    dedicationPrefix: 'Dedicated to ',
    dedicationName: 'Stefan Bergdoll',
    dedicationSuffix:
      ', who laid the foundation for my simulation work with the original BIOSIM and ' +
      'later entrusted me with the original source code. Without him this project would ' +
      'not exist — not even its name.',
    sectionOrigin: 'Namesake & origin',
    sectionCode: 'Open-source code references',
    sectionModels: 'Underlying scientific models',
    bergdollNote:
      'The original BIOSIM (© 1990–1993, BASF-AG Ludwigshafen) — a neural simulator for ' +
      'Windows. His program was the namesake and inspiration for this project; he has ' +
      'since also made the original source code available.',
    pyloricNote: 'MIT license. Parts of the STG integration follow this freely available implementation.',
    xolotlNote: 'Conceptual reference for the burst-neuron and half-centre examples. No code taken — thanks for the open example.',
    prinzNote: 'Similar network activity from disparate circuit parameters. Nature Neuroscience 7(12), 1345–1352.',
    gorurNote: 'Xolotl: An intuitive and approachable neuron and network simulator. Frontiers in Neuroinformatics 12, 87.',
    goncalvesNote: 'Training deep neural density estimators to identify mechanistic models of neural dynamics. eLife 9, e56261.',
  },

  params: {
    mode: 'Mode',
    modePresentation: 'Presentation',
    modeEditor: 'Editor',
    modeStudent: 'Student',
    tools: 'Tools',
    examples: 'Examples',
    presetInfoTitle: 'Show explanation & parameter tips',
    parametersFor: (model: string) => `Parameters — ${model}`,
    modelLIF: 'LIF',
    modelGraded: 'Non-spiking',
    modelHH: 'HH',
    modelSTG: 'STG (Prinz)',
    modelOptHH: 'Spiking (HH)',
    modelOptLIF: 'Spiking (LIF)',
    modelOptSTG: 'STG (Prinz)',
    modelOptGraded: 'Non-spiking',
    electrodeHint: '💡 Click the soma or a dendrite of the neuron to place a recording electrode.',
    synapse: 'Synapse',
    otherGroup: 'Other (no preset)',
    saveCurrent: '+ Save current state',
    importFileBtn: '⬆ Import file',
    noSaved: 'no saved states',
    namePrompt: 'Name for this state:',
    overwriteConfirm: (name: string) => `"${name}" already exists. Overwrite?`,
    deleteConfirm: (name: string) => `Delete "${name}"?`,
    exportTitle: 'Export as file',
    deleteTitle: 'Delete',
    bundledTitle: 'Bundled example (read-only)',
    loadSetupTitle: 'Load this state',
    savedStates: 'Saved states',
    savedInfoBtnTitle: 'Explanation: saving & sharing states',
    savedInfoTitle: 'Saving & sharing states',
    savedInfoIntro: 'A saved state is a snapshot of all current settings — neuron parameters, current stimulation and synapse strengths — under a name. It lets you restore a specific simulation exactly, any time.',
    savedInfoLocalLabel: 'Save locally (this browser)',
    savedInfoLocalBody: 'With "+ Save current state" the state stays in this browser and appears in the list — even after a reload. But it lives only on this device/browser and is not shared automatically.',
    savedInfoFileLabel: 'Save as file (to share)',
    savedInfoFileBody: 'With ⬇ you export a state as a .biosim.json file. You can pass this file to others (e.g. students or colleagues) or copy it to another device. Recipients bring it into their own list with ⬆ "Import file".',
    savedInfoBundledLabel: 'Bundled examples (🔒)',
    savedInfoBundledBody: 'States with a lock are shipped with the app (e.g. the collapsed rhythm). They are available immediately and cannot be changed or deleted — only loaded.',
    savedInfoClose: 'Close',
  },

  stg: {
    conductances: 'Conductances',
    driveNoise: 'Drive & noise',
    noiseLabel: 'Noise σ',
  },

  lif: {
    threshold: 'Threshold (mV)',
    stimulus: 'Stimulus',
    neuronParams: 'Neuron parameters',
  },

  hh: {
    stimulus: 'Stimulus',
    stimSite: 'Stimulus site',
    neuronParams: 'Neuron parameters',
    gCore: 'g_core (axial)',
  },

  stim: {
    type: 'Stimulus type',
    pulse: 'Pulse',
    ramp: 'Ramp',
    onset: 'Stimulus onset (ms)',
    plateau: 'Plateau duration (ms, 0=full)',
    stimDuration: 'Stimulus duration (ms, 0=full)',
    period: 'Repeat period (ms, 0=once)',
    rampTime: 'Ramp time (ms)',
    velocity: 'Velocity (× I)',
    acceleration: 'Acceleration (× I)',
  },

  syn: {
    mechanism: 'Mechanism',
    spikeDriven: 'Spike-driven (EPSC/IPSC)',
    graded: 'Graded (STG, chemical)',
    transmitter: 'Transmitter',
    glut: 'Glutamatergic (E=−70 mV, fast)',
    chol: 'Cholinergic (E=−80 mV, slow)',
    gradedConductance: 'Synaptic conductance ḡ (nS)',
    type: 'Type',
    excitatory: 'Excitatory',
    inhibitory: 'Inhibitory',
    target: 'Target (input site)',
    conductance: 'Conductance (nS)',
    delay: 'Delay (ms)',
    dend1: 'Dendrite 1',
    dend2: 'Dendrite 2',
    dend3: 'Dendrite 3',
    soma: 'Soma',
  },

  editor: {
    toolSelect: '🔒 Lock',
    toolSynapse: '🔗 Synapse',
    toolSpiking: '⚡ Spiking',
    toolNonspiking: '○ Non-spiking',
    toolAfferent: '▷ Afferent',
    delete: '🗑 Delete',
    deleteTitle: 'Delete the selected neuron or synapse',
    model: 'Model:',
    hint:
      'Placement tool → clicking an empty spot places a neuron. Synapse: click the ' +
      'source neuron, then the target neuron. Lock: no placing — select, move, set electrodes.',
  },

  canvas: {
    connectHint: 'Click the target neuron to connect the synapse',
    neuron: (n: number) => `Neuron ${n}`,
    zoomOut: 'Zoom out',
    zoom100: '100 %',
    zoomIn: 'Zoom in',
  },

  errorBoundary: {
    title: 'Something went wrong',
    body: 'The display triggered an error. Your network is still here — you can reset the simulation and keep working.',
    recover: 'Reset & continue',
    reload: 'Reload page',
  },

  confirm: {
    clearCanvas: 'Clear the canvas for the editor? (Cancel keeps the current network)',
  },

  fileError: {
    invalidJson: 'Invalid JSON',
    unknownVersion: (v: unknown) => `Unknown version: ${v}`,
    invalidFormat: 'Invalid network format',
    cancelled: 'Cancelled',
    noFile: 'No file selected',
  },

  presetInfo: {
    close: 'Close',
    whatCanIChange: 'What can I change?',
    compareTitle: 'Comparison with the literature',
    fig1: '① BioSim — our simulation (validated parameter set, with noise)',
    fig2Prefix: '② Reference simulator (mackelab/pyloric) — ',
    fig3Suffix: 'Original article ↗',
    citeTitle: 'Sources & citation',
    requested: 'requested by the authors',
    copyBibtex: 'Copy BibTeX',
    download: '⬇ Save explanation (.md)',
    mdWhatCanChange: 'Which parameters can I change?',
    mdComparison: 'Comparison with the literature',
    mdSources: 'Sources & citation',
    mdRequested: ' (requested by the authors)',
    simImgAlt: 'BioSim simulation of the pyloric traces',
    refImgAlt: 'Reference simulator mackelab/pyloric',
    litImgAlt: 'Literature: intracellular recording PD/LP/PY',
  },
}

export type Messages = typeof en
