/* BIOSIM H6 reader page — vanilla JS, no build step, no dependencies.
   Bilingual EN/DE. English is the default; German on click. */

const NUM = (x) => (typeof x === 'number' ? x.toFixed(3).replace(/\.?0+$/, '') : x);

let LANG = 'en';                 // current language
let activeHyp = 'h6';            // active case study: 'h6' | 'h5'
let timelineData = null;         // the ACTIVE hypothesis timeline (points at h6Timeline or h5Timeline)
let h6Timeline = null;
let h5Timeline = null;
let contrastData = null;
let loopData = null;
let traceData = null;
let loopSelected = 'hypothesis';
let contrastMode = 'slope';

/* Pick the active-language string from a { en, de } pair (or pass through). */
function t(val) {
  if (val == null) return '';
  if (typeof val === 'object' && ('en' in val || 'de' in val)) {
    return val[LANG] != null ? val[LANG] : (val.en != null ? val.en : val.de);
  }
  return val;
}

/* ---- Static UI strings (page chrome + the long primer prose) ------------- */
const UI = {
  eyebrow: { en: 'BIOSIM · An AI system as a scientist',
             de: 'BIOSIM · Ein KI-System als Wissenschaftler' },

  nav_overview: { en: 'Overview',   de: 'Überblick' },
  nav_loop:     { en: 'The loop',   de: 'Der Loop' },
  nav_case:     { en: 'Case study', de: 'Fallstudie' },
  nav_pipeline: { en: 'Pipeline',   de: 'Pipeline' },
  // Page header is hypothesis-specific (H6 default here; H5 variants below). Set in applyLanguage().
  h1: { en: 'How an AI notices and corrects its own mistake',
        de: 'Wie eine KI ihren eigenen Denkfehler bemerkt und korrigiert' },
  lede: {
    en: 'This is the story of an experiment in which a computer program behaves like a ' +
        'scientist: it forms a conjecture, tests it, twice notices on its own that it was ' +
        'wrong — and corrects course. All clickable, and explained without any prior knowledge.',
    de: 'Dies ist die Geschichte eines Experiments, in dem ein Computerprogramm sich wie ein ' +
        'Wissenschaftler verhält: Es stellt eine Vermutung auf, testet sie, merkt zweimal ' +
        'selbst, dass es sich geirrt hat — und bessert nach. Alles zum Durchklicken und ohne ' +
        'Vorwissen erklärt.',
  },
  h1_h5: { en: 'Which connections can the rhythm not do without?',
           de: 'Welche Verbindungen kann der Rhythmus nicht entbehren?' },
  lede_h5: {
    en: 'This is the story of an experiment in which a computer program behaves like a ' +
        'scientist: it asks whether every connection in a tiny nerve network is dispensable, ' +
        'tests it, and finds the ones the rhythm cannot survive without. All clickable, and ' +
        'explained without any prior knowledge.',
    de: 'Dies ist die Geschichte eines Experiments, in dem ein Computerprogramm sich wie ein ' +
        'Wissenschaftler verhält: Es fragt, ob jede Verbindung in einem winzigen Nervennetz ' +
        'entbehrlich ist, prüft das und findet die, ohne die der Rhythmus nicht überlebt. Alles ' +
        'zum Durchklicken und ohne Vorwissen erklärt.',
  },
  contrast_h2: { en: 'The heart of it: the same data, two points of view',
                 de: 'Der Kern des Ganzen: dieselben Daten, zwei Sichtweisen' },
  contrast_intro1: {
    en: 'Here you can follow the study\u2019s most important moment yourself. You will see the ' +
        'same four measurements — once as the AI read them at first, and once as it saw them ' +
        'after its self-correction. The measured values are identical. Only the way of reading ' +
        'them changed — and with it, the result flips completely.',
    de: 'Hier lässt sich der wichtigste Moment der Studie selbst nachvollziehen. Sie sehen gleich ' +
        'dieselben vier Messungen — einmal so, wie die KI sie zuerst gedeutet hat, und einmal so, ' +
        'wie sie sie nach ihrer Selbstkorrektur sah. Die Messwerte sind identisch. Nur die Art, sie ' +
        'zu lesen, hat sich geändert — und damit kehrt sich das Ergebnis komplett um.',
  },
  contrast_intro2: {
    en: 'At first a high measured value ("steep curve") was read as "strong pacemaker". The round-2 ' +
        'revision then read the large values of two controls as collapse instead — a real step ' +
        'forward at the time. Switch between the two readings with the buttons below. But keep in mind ' +
        'what the later work showed: this second reading was still too coarse — much of what it called ' +
        'collapse was a rhythm that kept running, as the voltage traces further down make plain.',
    de: 'Zunächst wurde ein hoher Messwert („steile Kurve") als „starker Taktgeber" gedeutet. Die ' +
        'Revision aus Runde 2 deutete die großen Werte zweier Regler dann als Kollaps — ein echter ' +
        'Fortschritt damals. Schalten Sie mit den Knöpfen zwischen beiden Deutungen um. Behalten Sie ' +
        'dabei aber im Blick, was die spätere Arbeit zeigte: Diese zweite Deutung war noch zu grob — ' +
        'vieles, was sie Kollaps nannte, war ein weiterlaufender Rhythmus, wie die Spannungsverläufe ' +
        'weiter unten deutlich machen.',
  },
  btn_slope: { en: '\u2460 Old point of view', de: '\u2460 Alte Sichtweise' },
  btn_collapse: { en: '\u2461 After the self-correction', de: '\u2461 Nach der Selbstkorrektur' },
  col_control: { en: 'Control', de: 'Regler' },
  col_effect: { en: 'Effect strength', de: 'Effektstärke' },
  col_collapse: { en: 'Rhythm collapses?', de: 'Bricht der Rhythmus zusammen?' },
  col_reading: { en: 'Interpretation', de: 'Deutung' },
  footer_plain: {
    en: 'Every number on this page comes straight from the experiment\u2019s stored result files — ' +
        'none was entered by hand. Anyone who wants to check finds, under each station, a link to ' +
        'the corresponding original file.',
    de: 'Alle Zahlen auf dieser Seite stammen direkt aus den gespeicherten Ergebnisdateien des ' +
        'Experiments — keine wurde von Hand eingetragen. Wer es genau nachprüfen möchte, findet unter ' +
        'jeder Station einen Link zur zugehörigen Originaldatei.',
  },
  footer_tech: {
    en: 'Technical: generated from the verdict JSONs (core/results/verdicts/) by ' +
        'docs/build_reader_site.cjs. Companion to the methods paper. Authors: Arne E. Sauer, Robert B. Driesang.',
    de: 'Technisch: erzeugt aus den Verdict-JSONs (core/results/verdicts/) durch ' +
        'docs/build_reader_site.cjs. Begleitend zum Methodenpaper. Autoren: Arne E. Sauer, Robert B. Driesang.',
  },
  // section headings inside stations
  h_hypothesis: { en: 'The conjecture under test', de: 'Die geprüfte Vermutung' },
  h_whathappens: { en: 'What happens here', de: 'Was hier passiert' },
  h_controls: { en: 'The four controls in the result', de: 'Die vier Regler im Ergebnis' },
  h_connections: { en: 'The connections in the result', de: 'Die Verbindungen im Ergebnis' },
  hyp_h6_label: { en: 'Cycle-period control (H6)', de: 'Zyklusperioden-Kontrolle (H6)' },
  hyp_h5_label: { en: 'Synapse dispensability (H5)', de: 'Synapsen-Entbehrlichkeit (H5)' },
  h_refined: { en: 'The new, sharpened finding', de: 'Der neue, geschärfte Befund' },
  h_source: { en: 'Source file', de: 'Quelldatei' },
  col_ctrl_short: { en: 'Control', de: 'Regler' },
  col_effect_short: { en: 'Effect strength', de: 'Effektstärke' },
  col_collapse_short: { en: 'Collapse?', de: 'Kollaps?' },
  col_reach_short: { en: 'Collapse-free reach', de: 'Kollapsfreie Reichweite' },
  verdict_refuted: { en: 'refuted', de: 'widerlegt' },
  verdict_supported: { en: 'supported', de: 'bestätigt' },
  source_view: { en: '\u2197 view on GitHub', de: '\u2197 auf GitHub ansehen' },
  refined_hint: {
    en: 'Plain-language summary of the AI\u2019s verdict. The verbatim original is in the linked source file.',
    de: 'Verständliche Zusammenfassung des KI-Urteils (Verdikt). Der wörtliche Originaltext steht in der verlinkten Quelldatei.',
  },
  trace_contrast_h2: {
    en: 'What a real collapse looks like — and why the eye stays in the loop',
    de: 'Wie ein echter Kollaps aussieht — und warum das Auge im Prozess bleibt',
  },
  trace_csv: {
    en: '\u2197 raw data (CSV) on GitHub',
    de: '\u2197 Rohdaten (CSV) auf GitHub',
  },
  build_meta: { en: 'Export', de: 'Export' },
  primer_guide_label: '',   // handled inside primer HTML
};

/* The primer is a block of formatted HTML per language. */
const PRIMER = {
  en: `
    <h2>What is this about — in plain words?</h2>
    <p>Picture a tiny nervous system. In certain crustaceans (crabs and lobsters) there is a small
       network of just a few nerve cells that moves the stomach rhythmically — much as a
       pacemaker sets the beat of a heart. This nerve network is so small and so well researched
       that it can be <em>fully rebuilt</em> inside a computer. That is exactly what the
       <strong>simulator</strong> is: a program that recomputes this three-cell nerve network
       millisecond by millisecond and so produces the natural rhythm artificially.</p>
    <p>The advantage of a simulation: you can safely turn dials that you could never change so
       precisely in a living animal. Each cell has many such dials (specialists call them
       <em>conductances</em> — think of them as little controls that set how easily signals flow).
       There are 31 of these controls, plus the connections between the cells. The central question
       in these case studies: <strong>which parts of this tiny network really matter — and can an AI
       find that out in a way you can fully check?</strong></p>
    <h3>And what is the remarkable part?</h3>
    <p>The remarkable part is not the biology but <em>who</em> is doing the research. An AI language
       model (the same kind of technology as ChatGPT) takes the role of the scientist: it works out
       which experiment would be worthwhile, and afterwards interprets the results in words. But —
       and this is the decisive trick — <strong>the AI is not allowed to do any calculating
       itself</strong>. Because language models tend to invent plausible-sounding numbers. So the
       work is strictly divided:</p>
    <ul class="roles">
      <li><span class="role-tag ai">The AI</span> proposes experiments and explains what results mean. It touches not a single number.</li>
      <li><span class="role-tag code">The simulator</span> computes every number exactly and verifiably. It is the "incorruptible calculator".</li>
      <li><span class="role-tag human">The human</span> sits in between as a checkpoint and releases each experiment before it runs.</li>
    </ul>
    <p>Why this is interesting: an AI that simply spits out answers is hard to check. This system, by
       contrast, is built so that you <em>can trust every number</em> — and still use the creative
       strength of the AI. And as one of the case studies shows, the AI can even do something one
       would hardly credit it with: <strong>notice that its own procedure was flawed, and correct it
       itself.</strong> Everything is traceable, step by step, below.</p>
    <p class="primer-guide">Below you can follow the process station by station. Click each one to see
       what the system thought, did and found out. In one of the studies, two of the stations are
       <strong>self-corrections</strong> — moments in which the AI recognised its own mistake.</p>
  `,
  de: `
    <h2>Worum geht es hier — in einfachen Worten?</h2>
    <p>Stellen Sie sich ein winziges Nervensystem vor. In bestimmten Krebstieren (Krabben und Hummern)
       gibt es ein kleines Netz aus nur wenigen Nervenzellen, das den Magen rhythmisch
       bewegt — ähnlich, wie ein Herzschrittmacher den Herzschlag taktet. Dieses Nervennetz ist so
       klein und so gut erforscht, dass man es im Computer <em>vollständig nachbauen</em> kann. Genau
       das ist der <strong>Simulator</strong>: ein Programm, das dieses Nervennetz aus drei Zellen
       Millisekunde für Millisekunde nachrechnet und so den natürlichen Rhythmus künstlich erzeugt.</p>
    <p>Der Vorteil einer Simulation: Man kann gefahrlos an Stellschrauben drehen, die man bei einem
       echten Tier niemals so kontrolliert verändern könnte. Jede Zelle hat zahlreiche solcher
       Stellschrauben (die Fachleute nennen sie <em>Leitfähigkeiten</em> — man kann sie sich als
       kleine Regler vorstellen, die bestimmen, wie leicht Signale fließen). Insgesamt gibt es 31
       solcher Regler, dazu die Verbindungen zwischen den Zellen. Die zentrale Frage dieser
       Fallstudien lautet: <strong>Welche Teile dieses winzigen Netzes sind wirklich wichtig — und
       kann eine KI das nachprüfbar herausfinden?</strong></p>
    <h3>Und was ist das Besondere?</h3>
    <p>Das Besondere ist nicht die Biologie, sondern <em>wer</em> hier forscht. Ein KI-Sprachmodell
       (dieselbe Art Technik wie bei ChatGPT) übernimmt die Rolle des Forschers: Es überlegt sich,
       welches Experiment sinnvoll wäre, und deutet hinterher die Ergebnisse in Worten. Aber — und das
       ist der entscheidende Trick — <strong>die KI darf selbst nicht rechnen</strong>. Denn
       Sprachmodelle neigen dazu, plausibel klingende Zahlen einfach zu erfinden. Deshalb ist die
       Arbeit streng geteilt:</p>
    <ul class="roles">
      <li><span class="role-tag ai">Die KI</span> schlägt Experimente vor und erklärt, was Ergebnisse bedeuten. Sie berührt keine einzige Zahl.</li>
      <li><span class="role-tag code">Der Simulator</span> rechnet jede Zahl exakt und nachprüfbar aus. Er ist der „unbestechliche Taschenrechner".</li>
      <li><span class="role-tag human">Der Mensch</span> sitzt als Kontrollinstanz dazwischen und gibt jedes Experiment frei, bevor es läuft.</li>
    </ul>
    <p>Warum das interessant ist: Eine KI, die einfach nur Antworten ausspuckt, kann man schlecht
       überprüfen. Dieses System dagegen ist so gebaut, dass man <em>jeder Zahl trauen</em> kann — und
       trotzdem die kreative Stärke der KI nutzt. Und wie eine der Fallstudien zeigt, kann die KI
       sogar etwas, das man ihr kaum zutraut: <strong>bemerken, dass ihr eigenes Vorgehen fehlerhaft
       war, und es selbst korrigieren.</strong> Alles ist unten Schritt für Schritt
       nachvollziehbar.</p>
    <p class="primer-guide">Unten können Sie den Ablauf Station für Station verfolgen. Klicken Sie
       jede an, um zu sehen, was das System gedacht, getan und herausgefunden hat. In einer der
       Studien sind zwei der Stationen <strong>Selbstkorrekturen</strong> — Momente, in denen die KI
       ihren eigenen Fehler erkannte.</p>
  `,
};

/* ---- Pipeline explainer (static content, both languages) ----------------- */
/* The exact chain that turns an approved JSON plan into one computed, stored
   number. `step`/`ref` are code identifiers (language-independent); only the
   `what` prose is bilingual. The two `hot` rows are where numbers are computed. */
const PIPELINE = {
  title: { en: 'Pipeline — from plan to a computed number',
           de: 'Ablauf — vom Plan zur berechneten Zahl' },
  intro: {
    en: 'How does a hypothesis (e.g. H5, H6) turn into computed numbers? The language model only ' +
        'proposes an experiment plan; deterministic code does the rest. Below is the exact chain from ' +
        'the approved JSON plan to a single stored result — the one step that actually runs the ' +
        'simulation is highlighted.',
    de: 'Wie wird aus einer Hypothese (z. B. H5, H6) eine berechnete Zahl? Das Sprachmodell schlägt nur ' +
        'einen Versuchsplan vor; alles Rechnen macht deterministischer Code. Unten steht die exakte Kette ' +
        'vom freigegebenen JSON-Plan bis zu einem gespeicherten Ergebnis — der eine Schritt, der die ' +
        'Simulation wirklich startet, ist hervorgehoben.',
  },
  cols: {
    n:    { en: '#',           de: '#' },
    step: { en: 'Step',        de: 'Schritt' },
    ref:  { en: 'File · line', de: 'Datei · Zeile' },
    what: { en: 'What happens', de: 'Was passiert' },
  },
  steps: [
    { n: '1', step: 'Approved plan (JSON)', ref: 'results/plans/*.json', hot: false,
      what: { en: 'The released experiment plan. Each experiment names one manipulation (e.g. a sweep of one conductance) — data only, nothing is computed yet.',
              de: 'Der genehmigte Versuchsplan. Jedes Experiment nennt eine Manipulation (z. B. einen Sweep eines Leitwerts) — nur Daten, noch wird nichts gerechnet.' } },
    { n: '2', step: 'runExperiment()', ref: 'runner.ts:62', hot: false,
      what: { en: 'The runner takes one manipulation from the plan and prepares the run: it builds the reference rhythm and the base parameter vector.',
              de: 'Der Runner nimmt eine Manipulation aus dem Plan und bereitet den Lauf vor: Referenzrhythmus und Basis-Parametervektor werden gebaut.' } },
    { n: '3', step: 'toVector()', ref: 'paramVector.ts:51', hot: false,
      what: { en: 'Converts the reference network into a vector of numbers in log10-conductance space (the 8 STG conductances per cell + each graded synapse).',
              de: 'Wandelt das Referenznetzwerk in einen Zahlenvektor im log10-Leitwert-Raum um (8 STG-Leitwerte pro Zelle + jede graduelle Synapse).' } },
    { n: '4', step: 'expand() → primitive', ref: 'runner.ts:39 · sweep.ts:17', hot: false,
      what: { en: 'The manipulation is unfolded into many concrete parameter settings. A sweep with 41 steps becomes 41 vectors, each nudging one conductance.',
              de: 'Die Manipulation wird in viele konkrete Reglerstellungen aufgefaltet. Ein Sweep mit 41 Schritten wird zu 41 Vektoren, jeder verstellt einen Leitwert.' } },
    { n: '5', step: 'loop over points', ref: 'runner.ts:69', hot: false,
      what: { en: 'The outer loop walks through every one of those settings — one simulation each.',
              de: 'Die äußere Schleife geht jede dieser Stellungen durch — je eine Simulation.' } },
    { n: '6', step: 'toNetwork()', ref: 'paramVector.ts:67', hot: false,
      what: { en: 'Turns one vector back into a real network object with the changed conductance values, ready to simulate.',
              de: 'Macht aus einem Vektor wieder ein echtes Netzwerk-Objekt mit den geänderten Leitwerten, bereit zur Simulation.' } },
    { n: '7', step: 'summaryStatsOf(net)', ref: 'runner.ts:71', hot: true,
      what: { en: '★ The line that starts a simulation. Called once per setting. Everything before is preparation; everything after is read-out.',
              de: '★ Die Zeile, die eine Simulation startet. Einmal pro Stellung aufgerufen. Alles davor ist Vorbereitung, alles danach Auswertung.' } },
    { n: '8', step: 'runVoltageTraces()', ref: 'sim.ts:19', hot: false,
      what: { en: 'The actual simulator. Runs 6000 ms of cell activity in 0.05 ms steps = 120,000 time steps, producing a voltage-over-time trace for all three cells.',
              de: 'Der eigentliche Simulator. Rechnet 6000 ms Zellaktivität in 0,05-ms-Schritten = 120.000 Zeitschritte und liefert den Spannungsverlauf aller drei Zellen.' } },
    { n: '9', step: 'networkStep() ×120,000', ref: 'network.ts:147', hot: true,
      what: { en: '★ Where the physics is computed: for each 0.05 ms tick it solves the ion-channel equations of every cell and returns the new membrane voltages.',
              de: '★ Hier wird die Physik gerechnet: pro 0,05-ms-Tick werden die Ionenkanal-Gleichungen jeder Zelle gelöst und die neuen Membranspannungen zurückgegeben.' } },
    { n: '10', step: 'summaryStatsFromTraces()', ref: 'metrics.ts:96', hot: false,
      what: { en: 'Reads the finished trace: finds bursts and spikes and boils them down to rhythm features — cycle period, burst durations, duty cycles, phases.',
              de: 'Liest den fertigen Verlauf: findet Bursts und Spikes und verdichtet sie zu Rhythmus-Merkmalen — Zyklusdauer, Burst-Längen, Duty Cycles, Phasen.' } },
    { n: '11', step: 'metric.evaluate()', ref: 'runner.ts:72', hot: false,
      what: { en: 'Compares those features to the reference and returns one normalised distance (plus a collapsed flag if the rhythm died).',
              de: 'Vergleicht diese Merkmale mit der Referenz und gibt eine normierte Distanz zurück (plus collapsed-Flag, falls der Rhythmus zusammenbrach).' } },
    { n: '12', step: 'RunResult stored', ref: 'runner.ts:73', hot: false,
      what: { en: 'The result is saved with provenance (software version, git revision, timestamp). All runs together are condensed into the digest the LLM interpreter later reads.',
              de: 'Das Ergebnis wird mit Provenienz gespeichert (Softwareversion, Git-Revision, Zeitstempel). Alle Läufe zusammen werden zum Digest verdichtet, den später der LLM-Interpreter liest.' } },
  ],
  loops: {
    title: { en: 'Two nested loops', de: 'Zwei ineinander verschachtelte Schleifen' },
    body: {
      en: 'Outer loop (runner.ts): over the parameter settings from the plan — e.g. 41 points. Inner loop ' +
          '(sim.ts): over time — 120,000 ticks per point. One 41-step sweep is therefore ≈ 5 million ' +
          'networkStep calls; the H5 study with 487 simulations was ≈ 58 million — all deterministic ' +
          '(noise = 0), so a run reproduces bit-for-bit at the same version.',
      de: 'Äußere Schleife (runner.ts): über die Reglerstellungen aus dem Plan — z. B. 41 Punkte. Innere ' +
          'Schleife (sim.ts): über die Zeit — 120.000 Ticks pro Punkt. Ein Sweep mit 41 Schritten sind also ' +
          '≈ 5 Millionen networkStep-Aufrufe; die H5-Studie mit 487 Simulationen ≈ 58 Millionen — alle ' +
          'deterministisch (noise = 0), ein Lauf ist bei gleicher Version bit-genau reproduzierbar.',
    },
  },
  seam: {
    title: { en: 'The exact seam', de: 'Die genaue Naht' },
    body: {
      en: 'The JSON plan only says WHAT to do. The model is actually executed inside sim.ts (the loop over ' +
          'networkStep), triggered by the single line summaryStatsOf(net) in runner.ts — once for every ' +
          'point a primitive produced from the plan. That is the seam between “plan” and “computed number”.',
      de: 'Der JSON-Plan sagt nur, WAS zu tun ist. Das Modell wird tatsächlich in sim.ts ausgeführt (die ' +
          'Schleife über networkStep), ausgelöst durch die eine Zeile summaryStatsOf(net) in runner.ts — ' +
          'einmal für jeden Punkt, den ein Primitive aus dem Plan erzeugt hat. Das ist die Naht zwischen ' +
          '„Plan“ und „berechneter Zahl“.',
    },
  },
};

async function loadJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load ${url} (${res.status})`);
  return res.json();
}

function el(tag, cls, html) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
}

/* ---- Apply language to the whole page ------------------------------------ */
function applyLanguage() {
  document.documentElement.lang = LANG;

  // Static [data-i18n] nodes
  document.querySelectorAll('[data-i18n]').forEach((node) => {
    const key = node.getAttribute('data-i18n');
    if (UI[key]) node.textContent = t(UI[key]);
  });

  // Hypothesis-specific page header (overrides the generic h1/lede set by the loop above)
  const h1El = document.querySelector('.site-header h1');
  const ledeEl = document.querySelector('.site-header .lede');
  if (h1El)   h1El.textContent   = t(activeHyp === 'h5' ? UI.h1_h5   : UI.h1);
  if (ledeEl) ledeEl.textContent = t(activeHyp === 'h5' ? UI.lede_h5 : UI.lede);

  // Primer block
  document.getElementById('primer-card').innerHTML = PRIMER[LANG];

  // Pipeline explainer (static content, re-rendered so it follows the language)
  renderPipeline();

  // Loop diagram
  if (loopData) renderLoop(loopData);

  // Voltage traces
  if (traceData) renderTraces();

  // Build-meta line
  if (timelineData) {
    document.getElementById('build-meta').textContent =
      `${t(UI.build_meta)}: ${timelineData.generatedAt.slice(0, 10)} · ${timelineData.hypothesisId}`;
  }

  // Case-study switcher: title above the timeline + button active states (H5 button hidden if no data)
  const tt = document.getElementById('timeline-title');
  if (tt && timelineData) tt.textContent = t(timelineData.title);
  const bH6 = document.getElementById('hyp-h6');
  const bH5 = document.getElementById('hyp-h5');
  if (bH6) bH6.classList.toggle('active', activeHyp === 'h6');
  if (bH5) {
    bH5.classList.toggle('active', activeHyp === 'h5');
    bH5.style.display = h5Timeline ? '' : 'none';
  }

  // Re-render the data-driven parts in the new language
  if (timelineData) renderTimeline(timelineData);
  if (contrastData) {
    document.getElementById('contrast-caption').textContent = t(contrastData.caption);
    document.getElementById('contrast-provenance').textContent =
      `${t({en:'Source',de:'Quelle'})}: ${contrastData.sourceFile} · v${contrastData.version} · ${contrastData.gitSha}`;
    setMode(contrastMode);
    const cg = document.getElementById('contrast-glossary');
    if (cg) { cg.innerHTML = ''; cg.appendChild(renderContrastGlossary()); }
  }

  // Toggle button active states
  document.getElementById('lang-en').classList.toggle('active', LANG === 'en');
  document.getElementById('lang-de').classList.toggle('active', LANG === 'de');
}

/* ---- Pipeline explainer table -------------------------------------------- */
function renderPipeline() {
  const titleEl = document.getElementById('pipeline-title');
  if (!titleEl) return;   // section not present
  titleEl.textContent = t(PIPELINE.title);
  document.getElementById('pipeline-intro').textContent = t(PIPELINE.intro);

  const c = PIPELINE.cols;
  const rows = PIPELINE.steps.map((s) =>
    `<tr class="${s.hot ? 'pl-hot' : ''}">` +
    `<td class="pl-num">${s.n}</td>` +
    `<td class="pl-step"><code>${s.step}</code></td>` +
    `<td class="pl-ref"><code>${s.ref}</code></td>` +
    `<td class="pl-what">${t(s.what)}</td>` +
    `</tr>`).join('');
  document.getElementById('pipeline-table').innerHTML =
    `<table class="pipeline-table">` +
    `<thead><tr>` +
    `<th class="pl-num">${t(c.n)}</th><th>${t(c.step)}</th><th>${t(c.ref)}</th><th>${t(c.what)}</th>` +
    `</tr></thead><tbody>${rows}</tbody></table>`;

  document.getElementById('pipeline-callouts').innerHTML =
    `<div class="pl-callout"><h3>${t(PIPELINE.loops.title)}</h3><p>${t(PIPELINE.loops.body)}</p></div>` +
    `<div class="pl-callout seam"><h3>${t(PIPELINE.seam.title)}</h3><p>${t(PIPELINE.seam.body)}</p></div>`;
}

/* ---- Loop diagram -------------------------------------------------------- */
const ACTOR_LABEL = {
  ai:    { en: 'AI', de: 'KI' },
  code:  { en: 'Simulator', de: 'Simulator' },
  human: { en: 'Human', de: 'Mensch' },
};

function renderLoop(loop) {
  document.getElementById('loop-title').textContent = t(loop.title);
  document.getElementById('loop-intro').textContent = t(loop.intro);
  document.getElementById('loop-footnote').textContent = t(loop.footnote);

  const diagram = document.getElementById('loop-diagram');
  diagram.innerHTML = '';

  loop.nodes.forEach((n, i) => {
    const node = el('button', `loop-node actor-${n.actor}` + (n.id === loopSelected ? ' selected' : ''));
    node.setAttribute('type', 'button');
    node.innerHTML =
      `<span class="loop-node-num">${n.order}</span>` +
      `<span class="loop-node-label">${t(n.label)}</span>` +
      `<span class="loop-node-actor">${t(ACTOR_LABEL[n.actor])}</span>`;
    node.addEventListener('click', () => {
      loopSelected = n.id;
      renderLoop(loop);
    });
    diagram.appendChild(node);

    if (i < loop.nodes.length - 1) {
      diagram.appendChild(el('span', 'loop-arrow', '\u2193'));
    }
  });

  // loop-back indicator
  diagram.appendChild(el('div', 'loop-back',
    t({ en: '\u21ba  the sharpened claim starts the next round',
        de: '\u21ba  die geschärfte Behauptung (Claim) startet die nächste Runde' })));

  // detail panel
  const sel = loop.nodes.find(n => n.id === loopSelected) || loop.nodes[0];
  const detail = document.getElementById('loop-detail');
  detail.className = `loop-detail actor-border-${sel.actor}`;
  detail.innerHTML =
    `<span class="loop-detail-actor actor-${sel.actor}">${t(ACTOR_LABEL[sel.actor])}</span>` +
    `<h3>${t(sel.title)}</h3>` +
    `<p>${t(sel.body)}</p>`;
}

/* ---- Voltage traces (SVG) ------------------------------------------------ */
// Draw a stacked three-cell voltage plot into an SVG string. Shared vertical
// scale across cells so spike heights are comparable, like the reference figure.
function traceSvg(block, cells, scaleBarMv) {
  const s = block.series;
  const W = 620, laneH = 90, gap = 10, padL = 62, padR = 16, padT = 8, padB = 26;
  const H = padT + cells.length * laneH + (cells.length - 1) * gap + padB;

  const tMin = s.t[0], tMax = s.t[s.t.length - 1];
  let vMin = Infinity, vMax = -Infinity;
  for (const c of cells) for (const v of s[c.key]) { if (v < vMin) vMin = v; if (v > vMax) vMax = v; }
  const vPad = (vMax - vMin) * 0.06;
  vMin -= vPad; vMax += vPad;

  const xOf = (t) => padL + ((t - tMin) / (tMax - tMin)) * (W - padL - padR);
  const laneTop = (i) => padT + i * (laneH + gap);
  const yOf = (v, i) => {
    const top = laneTop(i), bot = top + laneH;
    return bot - ((v - vMin) / (vMax - vMin)) * (bot - top);
  };

  let svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" class="trace-svg" preserveAspectRatio="xMidYMid meet">`;

  cells.forEach((c, i) => {
    const top = laneTop(i), bot = top + laneH;
    svg += `<line x1="${padL}" y1="${bot}" x2="${W - padR}" y2="${bot}" class="trace-axis"/>`;
    svg += `<text x="${padL - 10}" y="${(top + bot) / 2}" class="trace-cell-label" text-anchor="end" dominant-baseline="middle">${c.label}</text>`;
    const arr = s[c.key];
    let d = '';
    for (let k = 0; k < arr.length; k++) {
      const x = xOf(s.t[k]).toFixed(1);
      const y = yOf(arr[k], i).toFixed(1);
      d += (k === 0 ? 'M' : 'L') + x + ' ' + y + ' ';
    }
    svg += `<path d="${d.trim()}" class="trace-path" fill="none"/>`;
  });

  const barPxPerMv = laneH / (vMax - vMin);
  const barLen = scaleBarMv * barPxPerMv;
  const barX = padL + 8, barTop = laneTop(0) + 6;
  svg += `<line x1="${barX}" y1="${barTop}" x2="${barX}" y2="${barTop + barLen}" class="trace-scalebar"/>`;
  svg += `<text x="${barX + 6}" y="${barTop + barLen / 2}" class="trace-scale-label" dominant-baseline="middle">${scaleBarMv} mV</text>`;

  const tAxisY = H - 8;
  svg += `<text x="${padL}" y="${tAxisY}" class="trace-time-label">0</text>`;
  svg += `<text x="${W - padR}" y="${tAxisY}" class="trace-time-label" text-anchor="end">${Math.round(tMax)} ms</text>`;

  svg += `</svg>`;
  return svg;
}

function renderTraceBlock(container, block) {
  const wrap = el('div', 'trace-block');
  wrap.appendChild(el('h4', 'trace-title', t(block.title)));
  const fig = el('div', 'trace-figure');
  fig.innerHTML = traceSvg(block, traceData.cells, traceData.scaleBarMv);
  wrap.appendChild(fig);
  wrap.appendChild(el('p', 'trace-caption', t(block.caption)));
  const prov = `v${block.version} · ${String(block.gitSha).slice(0, 7)} · noise ${block.noise}` +
    (block.collapseParam ? ` · ${block.collapseParam} logfactor ${block.logfactor}` : '');
  wrap.appendChild(el('p', 'trace-prov', prov));
  if (block.permalink) {
    const link = el('a', 'trace-csv-link');
    link.href = block.permalink;
    link.target = '_blank';
    link.rel = 'noopener';
    link.innerHTML = `<span>${t(UI.trace_csv)}</span><span class="path">${block.sourceFile}</span>`;
    wrap.appendChild(link);
  }
  container.innerHTML = '';
  container.appendChild(wrap);
}

function renderTraces() {
  if (!traceData) return;
  // Reference rhythm at the top (below the primer)
  const refTop = document.getElementById('trace-reference');
  if (refTop) renderTraceBlock(refTop, traceData.reference);

  // Intact-vs-collapsed contrast further down
  const h2 = document.getElementById('trace-contrast-h2');
  if (h2) h2.textContent = t(UI.trace_contrast_h2);
  const note = document.getElementById('trace-contrast-note');
  if (note) note.textContent = t(traceData.contrastNote);
  const refPair = document.getElementById('trace-ref-pair');
  const colPair = document.getElementById('trace-col-pair');
  if (refPair) renderTraceBlock(refPair, traceData.reference);
  if (colPair) renderTraceBlock(colPair, traceData.collapsed);
}

/* ---- Timeline ------------------------------------------------------------ */
function renderTimeline(timeline) {
  const root = document.getElementById('timeline');
  root.innerHTML = '';

  timeline.stations.forEach((s, i) => {
    const station = el('article', `station ${s.kind}`);

    const head = el('button', 'station-head');
    head.setAttribute('aria-expanded', 'false');
    const marker = el('span', 'station-marker', s.kind === 'correction' ? '\u21ba' : String(i + 1));
    const titles = el('div', 'station-titles');
    titles.appendChild(el('h3', null, t(s.title)));
    if (s.subtitle) titles.appendChild(el('p', 'sub', t(s.subtitle)));
    head.appendChild(marker);
    head.appendChild(titles);
    head.appendChild(el('span', 'station-chevron', '\u203a'));

    const body = el('div', 'station-body');

    if (s.plainQuestion) {
      body.appendChild(el('p', 'leitfrage', `\u201e${t(s.plainQuestion)}\u201c`));
    }

    const badges = el('div', 'badge-row');
    if (s.version) badges.appendChild(el('span', 'badge', `v${s.version}`));
    if (s.gitSha) badges.appendChild(el('span', 'badge', s.gitSha));
    if (s.interpreter) badges.appendChild(el('span', 'badge', s.interpreter));
    if (s.verdict) {
      const vKey = s.verdict === 'refuted' ? UI.verdict_refuted
                 : s.verdict === 'supported' ? UI.verdict_supported : null;
      badges.appendChild(el('span', `badge verdict-${s.verdict}`, vKey ? t(vKey) : s.verdict));
    }
    body.appendChild(badges);

    if (s.hypothesis) {
      body.appendChild(el('h4', null, t(UI.h_hypothesis)));
      body.appendChild(el('p', 'hypothesis', t(s.hypothesis)));
    }

    body.appendChild(el('h4', null, t(UI.h_whathappens)));
    body.appendChild(el('p', null, t(s.explanation)));

    if (s.keyMetrics) body.appendChild(renderKeyMetrics(s.keyMetrics, t(s.plainMetricsIntro)));

    if (s.refinedClaim) {
      body.appendChild(el('h4', null, t(UI.h_refined)));
      body.appendChild(el('p', 'refined', t(s.refinedClaim)));
      body.appendChild(el('p', 'refined-hint', t(UI.refined_hint)));
    }

    if (s.note) body.appendChild(el('p', 'note', t(s.note)));

    if (s.sourceFile) {
      body.appendChild(el('h4', null, t(UI.h_source)));
      const link = el('a', 'source-link');
      link.href = s.permalink;
      link.target = '_blank';
      link.rel = 'noopener';
      link.innerHTML = `<span>${t(UI.source_view)}</span><span class="path">${s.sourceFile}</span>`;
      body.appendChild(link);
    }

    head.addEventListener('click', () => {
      const isOpen = station.classList.toggle('open');
      head.setAttribute('aria-expanded', String(isOpen));
    });

    station.appendChild(head);
    station.appendChild(body);
    root.appendChild(station);
  });
}

function renderMetricGlossary() {
  const g = {
    summary: { en: 'What do these numbers mean?', de: 'Was bedeuten diese Zahlen?' },
    slope_t: { en: 'Effect (slopeNearZero)', de: 'Effekt (slopeNearZero)' },
    slope_b: {
      en: 'Raw effect size: how steeply the rhythm changes when this conductance is ' +
          'nudged a little. A unit-free comparison number \u2014 higher means more ' +
          'sensitive. Caution: a high value can also come from the rhythm collapsing, ' +
          'not only from a clean shift of pace, so it is not meaningful on its own.',
      de: 'Rohe Effektst\u00e4rke: Wie steil sich der Rhythmus \u00e4ndert, wenn man diese ' +
          'Leitf\u00e4higkeit ein kleines St\u00fcck verstellt. Eine reine Vergleichszahl ohne ' +
          'Einheit \u2014 h\u00f6her hei\u00dft empfindlicher. Achtung: Ein hoher Wert kann auch ' +
          'entstehen, wenn der Rhythmus zusammenbricht, nicht nur wenn sich der Takt ' +
          'sauber verschiebt. Deshalb allein nicht aussagekr\u00e4ftig.',
    },
    coll_t: { en: 'Collapse (collapsedFraction)', de: 'Kollaps (collapsedFraction)' },
    coll_b: {
      en: "Fraction of a sweep's sample points where the rhythm collapsed (fell silent " +
          "or went to tonic firing). 0 = never, 1 = always. 0.29 means no valid rhythm " +
          "at 29 % of the points.",
      de: 'Anteil der Messpunkte eines Durchlaufs, an denen der Rhythmus zusammenbrach ' +
          '(verstummte oder in Dauerfeuer \u00fcberging). 0 = nie, 1 = immer. 0,29 bedeutet: ' +
          'an 29 % der Punkte kein g\u00fcltiger Rhythmus.',
    },
    reach_t: { en: 'Reach (maxDistanceSmooth)', de: 'Reichweite (maxDistanceSmooth)' },
    reach_b: {
      en: 'The honest measure of real pace control: how far the pace can be moved ' +
          'without collapsing the rhythm \u2014 collapse points are excluded. Unit-free and ' +
          'normalised; roughly 1 unit corresponds to about a 1.26-fold change in cycle ' +
          'length. We read \u2265 0.75 as a strong, \u2265 0.60 as a moderate, below that as a ' +
          'weak pace lever.',
      de: 'Die ehrliche Ma\u00dfzahl f\u00fcr echte Takt-Steuerung: Wie weit sich der Takt ' +
          'verschieben l\u00e4sst, ohne dass der Rhythmus zusammenbricht \u2014 die Kollaps-Punkte ' +
          'sind herausgerechnet. Einheitenlos und normiert; rund 1 Einheit entspricht ' +
          'etwa einer 1,26-fachen \u00c4nderung der Zyklusl\u00e4nge. Ab 0,75 werten wir als ' +
          'starken, ab 0,60 als mittleren, darunter als schwachen Takt-Hebel.',
    },
  };
  // Fixed, always-visible explainer block under the mini-table (not a collapsible panel).
  const box = el('div', 'metric-glossary');
  box.appendChild(el('h5', 'glossary-head', t(g.summary)));
  const mk = (tt, bb) => {
    const row = el('div', 'glossary-row');
    row.appendChild(el('dt', 'glossary-term', t(tt)));
    row.appendChild(el('dd', 'glossary-def', t(bb)));
    return row;
  };
  const dl = el('dl', 'glossary-list');
  dl.appendChild(mk(g.slope_t, g.slope_b));
  dl.appendChild(mk(g.coll_t, g.coll_b));
  dl.appendChild(mk(g.reach_t, g.reach_b));
  box.appendChild(dl);
  return box;
}

// Fixed explainer tailored to the always-visible core-contrast table, whose columns are only
// Effect strength (slopeNearZero) and Rhythm collapses? (collapsedFraction) — no maxDistanceSmooth —
// plus the ①/② before/after toggle. Kept separate from the station-5 glossary so each explains
// exactly the columns its own table shows.
function renderContrastGlossary() {
  const g = {
    summary: { en: 'What do these numbers mean?', de: 'Was bedeuten diese Zahlen?' },
    slope_t: { en: 'Effect strength (slopeNearZero)', de: 'Effektstärke (slopeNearZero)' },
    slope_b: {
      en: 'Raw effect size: how steeply the rhythm changes when this conductance is nudged a little. ' +
          'A unit-free comparison number — higher means more sensitive. Caution: a high value can also ' +
          'come from the rhythm collapsing, not only from a clean shift of pace, so it is not meaningful ' +
          'on its own.',
      de: 'Rohe Effektstärke: Wie steil sich der Rhythmus ändert, wenn man diese Leitfähigkeit ein ' +
          'kleines Stück verstellt. Eine reine Vergleichszahl ohne Einheit — höher heißt empfindlicher. ' +
          'Achtung: Ein hoher Wert kann auch entstehen, wenn der Rhythmus zusammenbricht, nicht nur wenn ' +
          'sich der Takt sauber verschiebt. Deshalb allein nicht aussagekräftig.',
    },
    coll_t: { en: 'Rhythm collapses? (collapsedFraction)', de: 'Bricht der Rhythmus zusammen? (collapsedFraction)' },
    coll_b: {
      en: "Fraction of a sweep's sample points where the rhythm collapsed (fell silent or went to tonic " +
          "firing). 0 = never, 1 = always. This column only appears in view ②; it is what tells a genuine " +
          "shift of pace apart from a rhythm that simply broke.",
      de: 'Anteil der Messpunkte eines Durchlaufs, an denen der Rhythmus zusammenbrach (verstummte oder in ' +
          'Dauerfeuer überging). 0 = nie, 1 = immer. Diese Spalte erscheint nur in Sicht ②; sie unterscheidet ' +
          'eine echte Takt-Verschiebung von einem Rhythmus, der einfach zusammenbrach.',
    },
    toggle_t: { en: 'The toggle (① / ②)', de: 'Der Umschalter (① / ②)' },
    toggle_b: {
      en: 'Two readings of the same data. ① Old point of view judges each control by effect strength alone — ' +
          'and a high value there was mistaken for pace control. ② After the self-correction adds the collapse ' +
          'column: a large effect that comes from the rhythm collapsing is now read as collapse, not as control. ' +
          'Switch between them to see how the interpretation changes.',
      de: 'Zwei Lesarten derselben Daten. ① Alte Sichtweise beurteilt jeden Regler allein an der Effektstärke — ' +
          'und ein hoher Wert dort wurde mit Takt-Steuerung verwechselt. ② Nach der Selbstkorrektur ergänzt die ' +
          'Kollaps-Spalte: Ein großer Effekt, der durch Zusammenbruch des Rhythmus entsteht, wird jetzt als ' +
          'Kollaps gelesen, nicht als Steuerung. Zum Vergleich hin- und herschalten.',
    },
  };
  const box = el('div', 'metric-glossary');
  box.appendChild(el('h5', 'glossary-head', t(g.summary)));
  const mk = (tt, bb) => {
    const row = el('div', 'glossary-row');
    row.appendChild(el('dt', 'glossary-term', t(tt)));
    row.appendChild(el('dd', 'glossary-def', t(bb)));
    return row;
  };
  const dl = el('dl', 'glossary-list');
  dl.appendChild(mk(g.slope_t, g.slope_b));
  dl.appendChild(mk(g.coll_t, g.coll_b));
  dl.appendChild(mk(g.toggle_t, g.toggle_b));
  box.appendChild(dl);
  return box;
}

// Colour tier from a reading tier keyword (shared by both metric kinds).
function tierClassOf(tier) {
  return tier === 'strong' ? 'reach-strong'
       : tier === 'moderate' || tier === 'indispensable' ? 'reach-moderate'
       : 'reach-weak';
}

// Descriptor-driven table (H5 and any future phase-metric hypothesis): the columns and rows
// come from the data (keyMetrics.columns / keyMetrics.rows), so no metric names are hardcoded.
function renderDescriptorTable(km) {
  const table = el('table', 'mini-table');
  const head = km.columns.map(c =>
    `<th>${t(c.label)}${c.sub ? `<span class="th-sub">${c.sub}</span>` : ''}</th>`).join('');
  table.innerHTML = `<thead><tr>${head}</tr></thead><tbody></tbody>`;
  const tb = table.querySelector('tbody');
  for (const row of km.rows) {
    const tierClass = tierClassOf(row.readingTier);
    const cells = km.columns.map(c => {
      if (c.key === 'entity') {
        const tag = row.tag ? ` <span class="ent-tag">${row.tag}</span>` : '';
        return `<td>${row.entityLabel || row.entity}${tag}</td>`;
      }
      if (c.key === 'reading') return `<td class="${tierClass}">${t(row.reading)}</td>`;
      let v = row[c.key];
      if (c.num) v = (v == null) ? '—' : NUM(v);   // em dash for "never broke"
      // colour the key column (the tolerated radius) by tier, like H6 colours the reach
      const keyCol = c.key === 'toleratedRadius';
      return `<td class="${c.num ? 'num' : ''}${keyCol ? ' ' + tierClass : ''}">${v}</td>`;
    }).join('');
    const tr = el('tr'); tr.innerHTML = cells; tb.appendChild(tr);
  }
  return table;
}

// Glossary rendered from data (H5 carries its own terms); same markup as the code-based H6 one.
function renderGlossaryFromData(g) {
  const box = el('div', 'metric-glossary');
  box.appendChild(el('h5', 'glossary-head', t(g.head)));
  const dl = el('dl', 'glossary-list');
  for (const term of g.terms) {
    const row = el('div', 'glossary-row');
    row.appendChild(el('dt', 'glossary-term', t(term.term)));
    row.appendChild(el('dd', 'glossary-def', t(term.def)));
    dl.appendChild(row);
  }
  box.appendChild(dl);
  return box;
}

function renderKeyMetrics(km, intro) {
  const wrap = el('div');
  const isDescriptor = km && Array.isArray(km.columns) && Array.isArray(km.rows);
  wrap.appendChild(el('h4', null, t(isDescriptor ? UI.h_connections : UI.h_controls)));
  if (intro) wrap.appendChild(el('p', 'metrics-intro', intro));

  if (isDescriptor) {
    // --- H5 / phase-metric path: table + glossary + cross-check all from the descriptor ---
    wrap.appendChild(renderDescriptorTable(km));
    if (km.glossary) wrap.appendChild(renderGlossaryFromData(km.glossary));
    if (km.randomDirections) {
      const rd = km.randomDirections;
      const txt = {
        en: `Cross-check in many random directions: aligned directions average ${NUM(rd.meanDistanceAligned)}, ` +
            `other directions ${NUM(rd.meanDistanceMisaligned)} — practically equal. So no single connection ` +
            `stands out; indispensability is shared.`,
        de: `Gegenprobe in viele zufällige Richtungen: ausgerichtete Richtungen im Mittel ${NUM(rd.meanDistanceAligned)}, ` +
            `andere Richtungen ${NUM(rd.meanDistanceMisaligned)} — praktisch gleich. Es sticht also keine einzelne ` +
            `Verbindung heraus; die Unentbehrlichkeit verteilt sich.`,
      };
      wrap.appendChild(el('p', 'rd-note', t(txt)));
    }
    return wrap;
  }

  // --- Legacy H6 / period-metric path (unchanged) ---
  const table = el('table', 'mini-table');
  table.innerHTML = `
    <thead><tr>
      <th>${t(UI.col_ctrl_short)}</th>
      <th>${t(UI.col_effect_short)}<span class="th-sub">slopeNearZero</span></th>
      <th>${t(UI.col_collapse_short)}<span class="th-sub">collapsedFraction</span></th>
      <th>${t(UI.col_reach_short)}<span class="th-sub">maxDistanceSmooth</span></th>
      <th>${t(UI.col_reading)}</th>
    </tr></thead>
    <tbody></tbody>`;
  const tb = table.querySelector('tbody');
  for (const [name, m] of Object.entries(km)) {
    if (name === 'randomDirections') continue;
    // Three-tier colour from the collapse-free reach.
    const reach = m.smoothReach;
    const tierClass = reach >= 0.75 ? 'reach-strong'
                    : reach >= 0.60 ? 'reach-moderate'
                    : 'reach-weak';
    const tr = el('tr');
    tr.innerHTML =
      `<td>abpd.${name}</td>` +
      `<td class="num">${NUM(m.slopeNearZero)}</td>` +
      `<td class="num">${NUM(m.collapsedFraction)}</td>` +
      `<td class="num ${tierClass}">${NUM(m.smoothReach)}</td>` +
      `<td class="${tierClass}">${t(m.reading)}</td>`;
    tb.appendChild(tr);
  }
  wrap.appendChild(table);
  wrap.appendChild(renderMetricGlossary());
  if (km.randomDirections) {
    const rd = km.randomDirections;
    const txt = {
      en: `Cross-check in random directions: the supposed main control is ${NUM(rd.meanDistanceAligned)}, ` +
          `random other directions ${NUM(rd.meanDistanceMisaligned)} — practically equal. So there is no ` +
          `single outstanding dial.`,
      de: `Gegenprobe in zufällige Richtungen: Der vermeintliche Haupt-Regler ist ${NUM(rd.meanDistanceAligned)}, ` +
          `zufällige andere Richtungen ${NUM(rd.meanDistanceMisaligned)} — praktisch gleich. Es gibt also keine ` +
          `einzelne herausragende Stellschraube.`,
    };
    wrap.appendChild(el('p', 'rd-note', t(txt)));
  }
  return wrap;
}

/* ---- Core contrast (before/after toggle) --------------------------------- */
function renderContrast(data) {
  contrastData = data;
  document.getElementById('contrast-caption').textContent = t(data.caption);
  document.getElementById('contrast-provenance').textContent =
    `${t({en:'Source',de:'Quelle'})}: ${data.sourceFile} · v${data.version} · ${data.gitSha}`;
  drawContrastRows();

  document.getElementById('btn-slope').addEventListener('click', () => setMode('slope'));
  document.getElementById('btn-collapse').addEventListener('click', () => setMode('collapse'));
}

function setMode(mode) {
  contrastMode = mode;
  document.getElementById('btn-slope').classList.toggle('active', mode === 'slope');
  document.getElementById('btn-collapse').classList.toggle('active', mode === 'collapse');
  const thDyn = document.getElementById('th-dynamic');
  const label = thDyn.querySelector('[data-i18n]');
  const sub = thDyn.querySelector('.th-sub');
  if (label) label.textContent = mode === 'slope' ? '\u2014' : t(UI.col_collapse);
  if (sub) sub.style.visibility = mode === 'slope' ? 'hidden' : 'visible';
  drawContrastRows();
}

function drawContrastRows() {
  if (!contrastData) return;
  const tb = document.querySelector('#contrast-table tbody');
  tb.innerHTML = '';
  contrastData.rows.forEach((r) => {
    const showCollapse = contrastMode === 'collapse';
    const tr = el('tr', showCollapse && r.collapsed ? 'is-collapse' : '');
    const reading = showCollapse ? t(r.readingCollapseAware) : t(r.readingSlopeOnly);
    const readingCls = showCollapse && r.collapsed ? 'reading-collapse'
                     : showCollapse ? 'reading-smooth' : '';
    tr.innerHTML =
      `<td>${r.conductance}</td>` +
      `<td class="num">${NUM(r.slopeNearZero)}</td>` +
      `<td class="num">${showCollapse ? NUM(r.collapsedFraction) : '\u2014'}</td>` +
      `<td class="${readingCls}">${reading}</td>`;
    tb.appendChild(tr);
  });
}

/* ---- Boot ---------------------------------------------------------------- */
function wireLanguageButtons() {
  document.getElementById('lang-en').addEventListener('click', () => { LANG = 'en'; applyLanguage(); });
  document.getElementById('lang-de').addEventListener('click', () => { LANG = 'de'; applyLanguage(); });
}

// The sections that only belong to the H6 (period/collapse) narrative: the reference-rhythm trace,
// the intact-vs-collapsed contrast trace, and the before/after core-contrast table. Hidden for H5.
const H6_ONLY_SECTIONS = ['trace-intro', 'trace-contrast', 'contrast'];

function setHypothesis(id) {
  if (id === 'h5' && !h5Timeline) return;   // H5 data absent → ignore
  activeHyp = id;
  timelineData = (id === 'h5') ? h5Timeline : h6Timeline;

  // Show H6-only sections for H6, hide them for H5. For H6, respect a missing traces file.
  for (const secId of H6_ONLY_SECTIONS) {
    const n = document.getElementById(secId);
    if (!n) continue;
    let show = (id === 'h6');
    if (show && !traceData && (secId === 'trace-intro' || secId === 'trace-contrast')) show = false;
    n.style.display = show ? '' : 'none';
  }
  applyLanguage();   // re-renders the timeline + title + switcher state in the active language
}

function wireHypothesisButtons() {
  const b6 = document.getElementById('hyp-h6');
  const b5 = document.getElementById('hyp-h5');
  if (b6) b6.addEventListener('click', () => setHypothesis('h6'));
  if (b5) b5.addEventListener('click', () => setHypothesis('h5'));
}

(async function () {
  wireLanguageButtons();
  wireHypothesisButtons();
  try {
    const [h6t, contrast, loop, h5t] = await Promise.all([
      loadJSON('data/h6_timeline.json'),
      loadJSON('data/h6_contrast.json'),
      loadJSON('data/h6_loop.json'),
      loadJSON('data/h5_timeline.json').catch(() => null),   // H5 optional (Milestone 1 data)
    ]);
    h6Timeline = h6t;
    h5Timeline = h5t;
    timelineData = h6Timeline;
    contrastData = contrast;
    loopData = loop;

    // Voltage traces are optional — load separately so a missing file never blocks the page.
    try {
      traceData = await loadJSON('data/h6_traces.json');
    } catch (e) {
      traceData = null;
    }

    renderContrast(contrast);
    setHypothesis('h6');   // sets section visibility + switcher state, then renders via applyLanguage()
  } catch (err) {
    document.getElementById('timeline').innerHTML =
      `<p style="color:#a23b2d">Error loading data: ${err.message}<br>` +
      `Is the page served over http:// (not file://)? fetch needs a local server.</p>`;
    console.error(err);
  }
})();
