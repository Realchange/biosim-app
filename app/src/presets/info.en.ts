// English preset explanations. Keyed by the @biosim/core preset name (stable id).
import type { PresetInfo, Citation } from './info'
import pyloricSimImg from '../assets/pyloric-sim-traces.png'
import pyloricRefImg from '../assets/pyloric-ref.png'
import pyloricLitImg from '../assets/pyloric-lit.png'

// Shared citations for the xolotl-derived examples.
const XOLOTL_CITATIONS: Citation[] = [
  {
    role: 'Simulator template (xolotl)',
    requested: true,
    text: 'Gorur-Shandilya S, Hoyland A, Marder E (2018). Xolotl: An Intuitive and Approachable Neuron and Network Simulator for Research and Teaching. Frontiers in Neuroinformatics 12:87. Code: github.com/sg-s/xolotl (GPL-3.0 — reimplemented here, not copied).',
    doi: '10.3389/fninf.2018.00087',
    bibtex:
      '@article{gorurshandilya2018xolotl,\n' +
      '  title={Xolotl: An Intuitive and Approachable Neuron and Network Simulator for Research and Teaching},\n' +
      '  author={Gorur-Shandilya, Srinivas and Hoyland, Alec and Marder, Eve},\n' +
      '  journal={Frontiers in Neuroinformatics},\n' +
      '  volume={12}, pages={87}, year={2018},\n' +
      '  doi={10.3389/fninf.2018.00087}\n}',
  },
  {
    role: 'Channel model',
    text: 'Prinz AA, Bucher D, Marder E (2004). Similar network activity from disparate circuit parameters. Nature Neuroscience 7(12):1345–1352.',
    doi: '10.1038/nn1352',
    bibtex:
      '@article{prinz2004similar,\n' +
      '  title={Similar network activity from disparate circuit parameters},\n' +
      '  author={Prinz, Astrid A and Bucher, Dirk and Marder, Eve},\n' +
      '  journal={Nature Neuroscience},\n' +
      '  volume={7}, number={12}, pages={1345--1352}, year={2004},\n' +
      '  publisher={Nature Publishing Group}\n}',
  },
]

export const PRESET_INFO_EN: Record<string, PresetInfo> = {
  'Aktionspotential': {
    name: 'Action Potential',
    summary:
      'A single neuron (Hodgkin-Huxley model) fires an action potential in response to a short stimulus pulse. ' +
      'You see the characteristic shape: fast depolarisation from Na⁺ influx, repolarisation from K⁺ efflux and the ' +
      'subsequent after-hyperpolarisation. The all-or-nothing principle applies.',
    tips: [
      { param: 'I_stim (stimulus strength)', effect: 'Higher = above threshold → AP. Too low → no AP (threshold not reached).' },
      { param: 'Stimulus duration', effect: 'Short (≈1 ms) → a single AP. 0 or long (sustained) → a spike train.' },
      { param: 'Stimulus onset', effect: 'Shifts the start time of the stimulus on the time axis.' },
      { param: 'g_Na', effect: 'Lower → the AP flattens or fails (like a local anaesthetic blocking Na⁺ channels).' },
      { param: 'g_K', effect: 'Higher → faster repolarisation and deeper after-hyperpolarisation.' },
      { param: 'Duration (bottom)', effect: '20–30 ms for a single AP; choose larger to see a rhythm.' },
    ],
  },
  'Exzitatorische Synapse': {
    name: 'Excitatory Synapse',
    summary:
      'The presynaptic neuron fires and, through an excitatory synapse, transmits a current onto the downstream ' +
      'neuron (EPSP). If the sum of the EPSPs reaches threshold, the postsynaptic neuron fires too.',
    tips: [
      { param: 'Conductance (synapse)', effect: 'Higher = stronger EPSP. Too small → the postsynaptic cell stays subthreshold (no AP).' },
      { param: 'Target / input site', effect: 'Dendrite 1 (near the soma) acts more strongly; dendrite 3 (distal) is attenuated electrotonically.' },
      { param: 'I_stim (postsynaptic)', effect: 'Higher moves the neuron closer to threshold → easier to trigger.' },
      { param: 'Delay', effect: 'Synaptic transmission time between the pre- and postsynaptic spike.' },
    ],
  },
  'Inhibitorische Synapse': {
    name: 'Inhibitory Synapse',
    summary:
      'The driving neuron fires and, through an inhibitory synapse, inhibits a resting neuron. You see a downward ' +
      'hyperpolarisation (IPSP) – the opposite of the excitatory synapse.',
    tips: [
      { param: 'Conductance (synapse)', effect: 'Higher = stronger hyperpolarisation (deeper IPSP).' },
      { param: 'Type (excitatory/inhibitory)', effect: 'Switching shows the difference directly: upward (EPSP) vs. downward (IPSP).' },
      { param: 'I_stim (inhibited)', effect: 'Above 0 lets the target fire on its own → the inhibition then visibly suppresses its firing.' },
      { param: 'Target / input site', effect: 'At the input site (dendrite) the deflection is larger than at the soma (cable attenuation).' },
    ],
  },
  'Reflexbogen': {
    name: 'Reflex Arc',
    summary:
      'Stretch reflex with reciprocal inhibition (Sherrington’s reciprocal innervation). A short “stretch” excites the ' +
      'sensory neuron (Ia afferent). It directly excites the agonist (the muscle contracts) AND a Ia interneuron that ' +
      'inhibits the antagonist (it relaxes). This shows the core principle: excitation of one, simultaneous inhibition ' +
      'of its counterpart. Modelled after Rybak et al. 2006, J Physiol (doi:10.1113/jphysiol.2006.118711).',
    tips: [
      { param: 'I_stim / stimulus duration (sensory)', effect: 'The “stretch”. During the stimulus window the reflex runs; before/after the agonist rests.' },
      { param: 'I_stim (antagonist)', effect: 'Its baseline tone. Higher → it fires more strongly, making the reflex inhibition all the more visible.' },
      { param: 'Conductance of the inhibitory synapse', effect: 'Stronger → the antagonist is silenced more clearly (reciprocal inhibition).' },
      { param: 'Electrodes', effect: 'Place them on agonist and antagonist: one fires while the other falls silent at the same time.' },
    ],
  },
  'Half-Center-Oszillator': {
    name: 'Half-Centre Oscillator',
    summary:
      'The simplest oscillator: two neurons that inhibit each other. Neither oscillates alone — ' +
      'the rhythm only emerges from the coupling. When one fires, it briefly silences the other; through the ' +
      'synaptic delay both settle into antiphase and fire alternately. This is the basic building block of the ' +
      'swim rhythm, reduced to a single half-centre.',
    tips: [
      { param: 'Conductance (inhibition)', effect: 'Too weak → no rhythm, both keep firing in sync. Stronger → clearer alternation.' },
      { param: 'I_stim', effect: 'The constant drive. Too low → no firing; very high → the inhibition can no longer silence, the rhythm collapses.' },
      { param: 'Delay', effect: 'The synaptic transmission time stabilises the antiphase and influences the period.' },
      { param: 'Asymmetry (I_stim N1 ≠ N2)', effect: 'A small difference breaks the symmetry so one side starts first.' },
    ],
  },
  'Schwimmrhythmus': {
    name: 'Swim Rhythm',
    summary:
      'A central pattern generator (CPG): mutual inhibition between the left and right side produces an ' +
      'alternating rhythm of the kind that underlies swimming movement.',
    tips: [
      { param: 'I_stim (CPG neurons)', effect: 'Drives the cells; higher → faster rhythm, too low → no firing.' },
      { param: 'Conductance (inhibitory)', effect: 'Stronger mutual inhibition → clearer left-right alternation.' },
      { param: 'Delay', effect: 'Influences the period and the phase offset between segments.' },
      { param: 'Duration (bottom)', effect: 'Choose large (e.g. 1000+ ms) to see several rhythm cycles.' },
    ],
  },
  'Pylorisches Netzwerk': {
    name: 'Pyloric Network',
    summary:
      'The pyloric network of the crab stomatogastric ganglion (Prinz, Bucher & Marder, Nat Neurosci 2004) – ' +
      'a classic central pattern generator. Three Prinz-type neurons, each with 8 voltage-gated currents and ' +
      'intracellular Ca²⁺ dynamics: the AB/PD pacemaker (bursts on its own) plus the followers LP and PY. Through the ' +
      'full canonical 7-synapse circuit (glutamatergic + cholinergic), the characteristic three-phase rhythm emerges, ' +
      'AB/PD → LP → PY (period ≈ 1 s): the pacemaker fires a short burst, inhibiting LP and PY; then LP recovers first ' +
      'and fires its long burst, inhibiting PY, and finally PY fires a short burst. ' +
      'This preset uses the exact validated parameter set from the reference code (mackelab/pyloric), including ' +
      'membrane noise – so our sim reproduces the reference simulator (see the comparison below). All 8 ' +
      'conductances of every neuron and all synapses are editable. Tip: place soma electrodes on all three.',
    tips: [
      { param: 'g_CaS / g_KCa (AB/PD)', effect: 'Drive the pacemaker burst (Ca influx vs. Ca-activated K efflux). Smaller g_CaS → shorter/no bursts; the whole rhythm depends on it.' },
      { param: 'g_A (LP, PY)', effect: 'The A-current delays firing. PY has a lot of it (40) → it fires last. Lower it → PY fires earlier, the phase separation blurs.' },
      { param: 'g_H (followers)', effect: 'Drives the recovery after inhibition (post-inhibitory rebound). Larger → faster rebound, earlier follower bursts.' },
      { param: 'g_KCa (LP)', effect: 'The Ca-activated K-current terminates the LP burst on its own (adaptation). Without it LP fires tonically and the ordering blurs.' },
      { param: 'Cholinergic AB/PD→follower synapse', effect: 'E_syn=−80 mV, slow: provides the strong, sustained inhibition that shapes the clean rebound burst of the followers. Remove it → bursts get messy.' },
      { param: 'ḡ synapse AB/PD→LP/PY', effect: 'Stronger → followers are silenced more deeply/longer. Too strong → a follower goes fully silent; too weak → it fires tonically.' },
      { param: 'ḡ synapse LP→PY / PY→LP', effect: 'LP→PY pushes PY behind LP; PY→LP feedback helps terminate the LP burst. Together they produce the clear phase separation.' },
      { param: 'Noise σ', effect: 'Gaussian noise current per time step (reference: 0.001 µA). Produces the baseline jitter / passive behaviour. Set to 0 → smooth, idealised traces.' },
      { param: '🎚 Live mode', effect: 'With “Live” (instead of Start) the simulation runs forever and you drag the conductances with the sliders while the rhythm runs — e.g. lower g_CaS and watch the three-phase pattern tip over. “↺ Preset” restores the original values.' },
      { param: 'Duration (bottom)', effect: 'The rhythm runs with a period ≈ 1 s. Choose 4000–5000 ms to see several cycles.' },
    ],
    comparison: {
      intro: 'Robustness check: our simulation (top) reproduces the established ' +
        'reference simulator (mackelab/pyloric, middle) — same model, same validated ' +
        '31-parameter set, including the membrane noise. And both match a real ' +
        'intracellular recording (bottom).',
      simImg: pyloricSimImg,
      refImg: pyloricRefImg,
      refCaption: 'Reference simulator: the same Prinz parameter set, run in the original code ' +
        'mackelab/pyloric (dt=0.025 ms, t=283 K, noise_std=0.001). Generated by you with the ' +
        'unmodified repository.',
      litImg: pyloricLitImg,
      litCaption: 'Biology: PD/LP/PY intracellular (crab). Panel A at various temperatures ' +
        '(the 11 °C column is the most comparable). Source: Tang LS, Goeritz ML, Caplan JS, ' +
        'Taylor AL, Fisek M, Marder E (2010), PLoS Biology 8(8):e1000469, license CC BY 4.0.',
      litHref: 'https://journals.plos.org/plosbiology/article?id=10.1371/journal.pbio.1000469',
      points: [
        { ok: true, text: 'Same equations: 8 ionic currents, Ca²⁺ dynamics and graded synapses are ported line by line from the reference code.' },
        { ok: true, text: 'Same parameters: the exact validated 31-value set from the reference test produces the same dynamics in our sim.' },
        { ok: true, text: 'Same three-phase pattern AB/PD → LP → PY: short AB/PD burst, long LP burst, short PY burst afterwards, period ≈ 1 s.' },
        { ok: true, text: 'Same noise / passive behaviour: a Gaussian noise current (σ=0.001 µA per step, as in the reference) produces the same baseline jitter.' },
        { ok: false, text: 'Minimal residual difference: our period is ~5–9 % longer and the noise realisation is seeded differently — the dynamics are identical.' },
      ],
    },
    citations: [
      {
        role: 'Original model',
        text: 'Prinz AA, Bucher D, Marder E (2004). Similar network activity from disparate circuit parameters. Nature Neuroscience 7(12):1345–1352.',
        doi: '10.1038/nn1352',
        bibtex:
          '@article{prinz2004similar,\n' +
          '  title={Similar network activity from disparate circuit parameters},\n' +
          '  author={Prinz, Astrid A and Bucher, Dirk and Marder, Eve},\n' +
          '  journal={Nature Neuroscience},\n' +
          '  volume={7}, number={12}, pages={1345--1352}, year={2004},\n' +
          '  publisher={Nature Publishing Group}\n}',
      },
      {
        role: 'Simulator (mackelab/pyloric)',
        requested: true,
        text: 'Deistler M, Macke JH, Gonçalves PJ (2022). Energy-efficient network activity from disparate circuit parameters. PNAS 119(44):e2207632119.',
        doi: '10.1073/pnas.2207632119',
        bibtex:
          '@article{deistler2022energy,\n' +
          '  title={Energy-efficient network activity from disparate circuit parameters},\n' +
          '  author={Deistler, Michael and Macke, Jakob H and Gon{\\c{c}}alves, Pedro J},\n' +
          '  journal={Proceedings of the National Academy of Sciences},\n' +
          '  volume={119}, number={44}, pages={e2207632119}, year={2022},\n' +
          '  publisher={National Acad Sciences}\n}',
      },
    ],
  },
  'Xolotl: Burst-Neuron': {
    name: 'Xolotl: Bursting Neuron',
    summary:
      'A single conductance-based neuron that bursts on its own — the signature demo of the ' +
      'simulator “xolotl” (Gorur-Shandilya, Hoyland & Marder 2018). It uses the same STG channel set ' +
      'as the pyloric model (8 currents + Ca²⁺), here with the conductances from xolotl’s BurstingNeuron ' +
      'example. The interplay of Ca influx (CaS/CaT), Ca-activated K-current (KCa) and the slow H-current ' +
      'produces the alternation of burst and silence. Note: the model is reimplemented in our engine ' +
      '(xolotl’s code is GPL-3.0 and is not used); the published Prinz equations are free. ' +
      'All 8 conductances are editable — try how the burst changes.',
    tips: [
      { param: 'g_CaS / g_CaT', effect: 'Ca influx drives the slow depolarisation (the plateau build-up). Lower → shorter/no bursts.' },
      { param: 'g_KCa', effect: 'Ca-activated K-current terminates the burst. Larger → shorter bursts; at 0 → tonic continuous firing.' },
      { param: 'g_A', effect: 'A-current delays/slows; influences spike rate and burst shape.' },
      { param: 'g_H', effect: 'H-current drives the recovery between bursts → helps set the burst frequency.' },
      { param: 'I_stim', effect: 'Additional DC current shifts the neuron towards continuous firing or silence.' },
      { param: '🎚 Live mode', effect: 'Just like in xolotl: with “Live” the simulation runs forever and you change the conductances with the sliders while the neuron bursts — e.g. raise g_KCa → shorter bursts.' },
      { param: 'Duration (bottom)', effect: 'Period ≈ 0.7 s. 3000–4000 ms show several bursts.' },
    ],
    citations: XOLOTL_CITATIONS,
  },
  'Xolotl: Half-Center-Oszillator': {
    name: 'Xolotl: Half-Centre Oscillator',
    summary:
      'Two identical bursting neurons inhibit each other — a half-centre oscillator, the ' +
      'basic motif of many central pattern generators (swimming, breathing, chewing). The reciprocal inhibition ' +
      'forces the two cells into antiphase: when one fires, the other is silent, and vice versa. ' +
      'Inspired by the HCO example of the simulator xolotl (Gorur-Shandilya, Hoyland & Marder 2018). ' +
      'Implementation note: xolotl’s HCO uses an escape/release mechanism (non-bursting cells + ' +
      'a very slow H-current); since our H-current has a fixed time constant, we use two ' +
      'intrinsic bursters with reciprocal inhibition — the same half-centre phenomenon (antiphase bursting). ' +
      'A little membrane noise breaks the initial symmetry.',
    tips: [
      { param: 'ḡ synapse (reciprocal)', effect: 'Strength of the mutual inhibition. Too weak → the cells synchronise; stronger → clearer antiphase. Keep both synapses equal.' },
      { param: 'g_CaS / g_KCa (cells)', effect: 'Determine the intrinsic bursting of each cell — and hence the period and burst duration of the half-centre.' },
      { param: 'Noise σ', effect: 'Breaks the symmetry of the two identical cells so one side starts first. At 0 → the start can be undetermined.' },
      { param: '🎚 Live mode', effect: 'With “Live” the oscillator runs forever; drag the reciprocal synapse strength or the conductances and see how the tempo and alternation change.' },
      { param: 'Duration (bottom)', effect: 'Period ≈ 1.2 s. Choose 5000–6000 ms to see the alternation several times. Place electrodes on both somata.' },
    ],
    citations: XOLOTL_CITATIONS,
  },
}
