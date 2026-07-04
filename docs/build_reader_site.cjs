#!/usr/bin/env node
/**
 * build_reader_site.cjs
 * -----------------------------------------------------------------------------
 * Curated, bilingual (EN/DE) export for the public H6 reader page (GitHub Pages).
 *
 * Reads the real verdict JSONs from core/results/verdicts/ and writes a
 * reader-facing, curated subset into docs/data/. Curated prose (station titles,
 * explanations, source-file mapping) lives here as { en, de } pairs; every
 * NUMBER is pulled from the verdict files at build time, never hand-entered.
 *
 * Run from repo root:
 *   node docs/build_reader_site.cjs
 *
 * Output:
 *   docs/data/h6_timeline.json     the five stations (bilingual)
 *   docs/data/h6_contrast.json     the before/after core contrast (bilingual)
 *   docs/data/sources/*.json       verbatim copies of the four key verdicts
 * -----------------------------------------------------------------------------
 */

const fs = require('fs');
const path = require('path');

// --- Paths -------------------------------------------------------------------
const REPO_ROOT   = path.resolve(__dirname, '..');
const VERDICT_DIR = path.join(REPO_ROOT, 'core', 'results', 'verdicts');
const OUT_DIR     = path.join(__dirname, 'data');
const SRC_OUT_DIR = path.join(OUT_DIR, 'sources');

// GitHub repo coordinates for permalinks.
const GH_OWNER = 'Realchange';
const GH_REPO  = 'biosim-app';
const GH_REF   = 'main';   // published copies live on main under docs/data/sources/

// --- The four verdict files central to the H6 case study ---------------------
const KEY_VERDICTS = {
  round1:        { frag: '14-08-07', file: null },
  round2_raw:    { frag: '15-08-28', file: null },
  round2_reeval: { frag: '17-55-14', file: null },  // the core case
  round3:        { frag: '18-38-09', file: null },
};

function resolveVerdictFiles() {
  const all = fs.readdirSync(VERDICT_DIR).filter(f => f.endsWith('.json'));
  for (const key of Object.keys(KEY_VERDICTS)) {
    const frag = KEY_VERDICTS[key].frag;
    const match = all.find(f => f.includes('h6-period-control') && f.includes(frag));
    if (!match) {
      throw new Error(`Could not find H6 verdict for fragment "${frag}". ` +
        `Files present: ${all.filter(f => f.includes('h6')).join(', ')}`);
    }
    KEY_VERDICTS[key].file = match;
  }
}

function loadVerdict(key) {
  const file = KEY_VERDICTS[key].file;
  const raw = fs.readFileSync(path.join(VERDICT_DIR, file), 'utf8');
  return { file, data: JSON.parse(raw) };
}

// Pull one experiment's metrics by matching its label substring.
// NOTE: some conductances appear twice (reduction AND increase direction) under
// the same label, e.g. "sweep abpd.gKd" with collapsedFraction 0.804 (reduction)
// and 0 (increase). For the H6 story the collapse-bearing direction is the one
// that matters — it is what the metric revision exposes. So when several
// experiments share the label, prefer the row with the highest collapsedFraction;
// on ties (all zero) fall back to the first, well-defined for the genuinely
// smooth conductances (gCaT, gKCa) that never collapse.
function findExp(digest, labelIncludes) {
  const matches = digest.experiments.filter(
    e => e.label && e.label.includes(labelIncludes) && e.kind === 'sweep'
  );
  if (matches.length === 0) return undefined;
  if (matches.length === 1) return matches[0];
  return matches.reduce((best, e) => {
    const cf  = (e.metrics && e.metrics.collapsedFraction) || 0;
    const bcf = (best.metrics && best.metrics.collapsedFraction) || 0;
    return cf > bcf ? e : best;
  });
}

// The verdict files are published (verbatim) under docs/data/sources/. Links must
// point there — NOT to core/results/verdicts/, which is not part of the public repo.
// The original experiment commit (provenance.gitSha) is still shown as a badge on
// each station, so scientific origin is preserved even though the clickable link
// resolves to the published copy.
function publishedPath(file) {
  return `docs/data/sources/${file}`;
}
function permalink(file) {
  return `https://github.com/${GH_OWNER}/${GH_REPO}/blob/${GH_REF}/${publishedPath(file)}`;
}

// --- Curated station metadata (prose human-authored EN+DE; numbers injected) -
function buildTimeline() {
  const r1 = loadVerdict('round1');
  const r2raw = loadVerdict('round2_raw');
  const r2re = loadVerdict('round2_reeval');
  const r3 = loadVerdict('round3');

  const stations = [];

  // Station 1 — Round 1: H6 refuted under wide sweeps
  stations.push({
    id: 'round1',
    kind: 'round',
    title: {
      en: 'Round 1 — H6 stated and refuted',
      de: 'Runde 1 — H6 aufgestellt und widerlegt',
    },
    subtitle: {
      en: 'Wide measurement series (sweeps) across six orders of magnitude',
      de: 'Weite Messreihen (Sweeps) über sechs Größenordnungen',
    },
    plainQuestion: {
      en: 'Is there a single pacemaker?',
      de: 'Gibt es den einen Taktgeber?',
    },
    version: r1.data.provenance.codeVersion,
    gitSha: r1.data.provenance.gitSha,
    interpreter: r1.data.provenance.interpreter,
    hypothesis: {
      en: 'There is one decisive control that sets the pace of the rhythm: turning it ' +
        'changes the pace noticeably, while all other controls have little effect.',
      de: 'Es gibt den einen entscheidenden Regler, der den Takt des Rhythmus bestimmt: ' +
        'Dreht man an ihm, ändert sich der Takt deutlich; alle anderen Regler haben kaum Einfluss.',
    },
    verdict: r1.data.interpretation.verdict,
    explanation: {
      en: 'To test the guess, the system turns each control across a very wide range and ' +
        'watches how much the rhythm changes each time. The result is surprising: the very ' +
        'control one would have expected to be the main pacemaker turns out to be the weakest — ' +
        'and others thought unimportant turn out strongest. So the guess of "a single pacemaker" ' +
        'is refuted, for now. The system names a new suspect (a control called gKd) — but this ' +
        'result rests on shaky ground, as the next station shows.',
      de: 'Um die Vermutung zu prüfen, dreht das System bei jedem Regler über einen sehr weiten ' +
        'Bereich und schaut, wie stark sich der Rhythmus jeweils ändert. Das Ergebnis ist ' +
        'überraschend: Ausgerechnet der Regler, den man für den Haupt-Taktgeber gehalten hätte, ' +
        'wirkt am schwächsten — und andere, die man für unwichtig hielt, wirken am stärksten. Die ' +
        'Vermutung „ein einziger Taktgeber" ist damit erst einmal widerlegt. Das System benennt ' +
        'einen neuen Verdächtigen (einen Regler namens gKd) — doch dieses Ergebnis steht auf ' +
        'wackligem Boden, wie die nächste Station zeigt.',
    },
    sourceFile: publishedPath(r1.file),
    permalink: permalink(r1.file),
    refinedClaim: {
      en: 'A single control does not pace the rhythm across the board. The sharper follow-up claim ' +
        'names one specific control (gKd) as the strongest candidate — to be put to a stricter test ' +
        'in the next round.',
      de: 'Ein einzelner Regler taktet den Rhythmus nicht auf ganzer Linie. Die geschärfte ' +
        'Nachfolge-Behauptung (Claim) benennt einen bestimmten Regler (gKd) als stärksten Kandidaten — der in der ' +
        'nächsten Runde einer strengeren Prüfung unterzogen wird.',
    },
  });

  // Station 2 — Self-correction 1: sweep-design fix
  stations.push({
    id: 'correction1',
    kind: 'correction',
    title: {
      en: 'Self-correction 1 — the experiment design',
      de: 'Selbstkorrektur 1 — das Experiment-Design',
    },
    subtitle: {
      en: 'Saturation spotted → narrow, high-resolution sweeps',
      de: 'Sättigung erkannt → schmale, hochauflösende Messreihen',
    },
    plainQuestion: {
      en: 'Was the measurement even meaningful?',
      de: 'War die Messung überhaupt aussagekräftig?',
    },
    version: r1.data.provenance.codeVersion,
    gitSha: r1.data.provenance.gitSha,
    interpreter: r1.data.provenance.interpreter,
    explanation: {
      en: 'Before trusting the round-1 result, the system checks how it came about — and finds a ' +
        'flaw in its own procedure. Picture it this way: the controls had been turned across far ' +
        'too wide a range, so wide that the measuring instrument only ever showed "full deflection". ' +
        'But if the instrument is permanently pinned at its maximum, fine differences between the ' +
        'controls can no longer be seen — which partly distorted the ranking. Crucially, the system ' +
        'does not change its result, it changes its procedure. It repeats the measurement at much ' +
        'finer settings, within a narrow range where the instrument gives meaningful values again.',
      de: 'Bevor das System dem Ergebnis aus Runde 1 traut, prüft es, wie es zustande kam — und ' +
        'findet einen Fehler im eigenen Vorgehen. Bildlich gesprochen: Man hatte die Regler über ' +
        'einen viel zu großen Bereich verdreht, so weit, dass das Messgerät nur noch „Vollausschlag" ' +
        'anzeigte. Wenn das Messgerät aber ständig am Anschlag steht, kann man feine Unterschiede ' +
        'zwischen den Reglern gar nicht mehr erkennen — das Ranking war dadurch teilweise verzerrt. ' +
        'Wichtig: Das System ändert nicht sein Ergebnis, sondern sein Vorgehen. Es wiederholt die ' +
        'Messung mit viel feinerer Einstellung, in einem engen Bereich, in dem das Messgerät wieder ' +
        'sinnvolle Werte liefert.',
    },
    note: {
      en: 'This is the first of two self-corrections — here the AI repairs the experiment. This kind ' +
        'of correction could also be done by a fixed rule; the second one (station 4) could not.',
      de: 'Dies ist die erste von zwei Selbstkorrekturen — hier repariert die KI das Experiment. ' +
        'Diese Art Korrektur könnte auch eine feste Regel leisten; die zweite (Station 4) nicht.',
    },
  });

  // Station 3 — Round 2 raw: collapse mistaken for control
  stations.push({
    id: 'round2_raw',
    kind: 'round',
    title: {
      en: 'Round 2 (raw) — collapse mistaken for control',
      de: 'Runde 2 (roh) — Kollaps als Kontrolle missdeutet',
    },
    subtitle: {
      en: 'Before the metric revision (v0.60)',
      de: 'Vor der Überarbeitung der Messgröße (Metrik) (v0.60)',
    },
    plainQuestion: {
      en: 'Two controls look strong — but why?',
      de: 'Zwei Regler sehen stark aus — aber warum?',
    },
    version: r2raw.data.provenance.codeVersion,
    gitSha: r2raw.data.provenance.gitSha,
    interpreter: r2raw.data.provenance.interpreter,
    explanation: {
      en: 'With the finer measurement, two controls (gKd and gCaS) now look especially strong. The ' +
        'instrument shows a powerful effect for both. But here lurks the next trap: a powerful ' +
        'effect can mean two things. Either the control shifts the pace smoothly and in a ' +
        'controlled way — or it strangles the rhythm entirely. On the instrument, both look the same ' +
        'at first. The instrument of the time could only tell "rhythm there or not there" and so ' +
        'conflated these two completely different things. Exactly this error is uncovered in the ' +
        'next station.',
      de: 'Mit der feineren Messung sehen jetzt zwei Regler (gKd und gCaS) besonders stark aus. Das ' +
        'Messgerät zeigt für beide einen kräftigen Effekt. Doch hier lauert die nächste Falle: Ein ' +
        'kräftiger Effekt kann zweierlei bedeuten. Entweder verschiebt der Regler den Takt sauber ' +
        'und kontrolliert — oder er würgt den Rhythmus ganz ab. Beides sieht auf dem Messgerät ' +
        'zunächst gleich aus. Das damalige Messgerät konnte nur „Rhythmus da oder nicht da" ' +
        'unterscheiden und vermischte deshalb diese zwei völlig verschiedenen Dinge. Genau dieser ' +
        'Fehler wird in der nächsten Station aufgedeckt.',
    },
    sourceFile: publishedPath(r2raw.file),
    permalink: permalink(r2raw.file),
  });

  // Station 4 — Self-correction 2: the metric itself is revised
  stations.push({
    id: 'correction2',
    kind: 'correction',
    title: {
      en: 'Self-correction 2 — the measuring instrument itself',
      de: 'Selbstkorrektur 2 — das Messinstrument selbst',
    },
    subtitle: {
      en: 'A collapse measure (collapsedFraction) introduced as its own category',
      de: 'Ein Kollaps-Maß (collapsedFraction) als eigene Kategorie eingeführt',
    },
    plainQuestion: {
      en: 'Is the instrument even measuring the right thing?',
      de: 'Misst das Messgerät überhaupt das Richtige?',
    },
    version: r2re.data.provenance.codeVersion,
    gitSha: r2re.data.provenance.gitSha,
    interpreter: r2re.data.provenance.interpreter,
    explanation: {
      en: 'This is the decisive moment of the whole study. The system recognises: the flaw is not in ' +
        'the experiment but in the measuring instrument itself. Strangling a rhythm is something ' +
        'fundamentally different from finely adjusting its pace — but the old instrument threw both ' +
        'into one pot. So the system rebuilds its own instrument: it introduces a new quantity that ' +
        'specifically records whether the rhythm collapses (in technical terms "collapsedFraction"). ' +
        'A collapsed rhythm now counts as its own category and no longer as a "strong change of pace". ' +
        'Because every earlier result was stored with full provenance, the system can simply ' +
        're-evaluate the same round-2 measurements with the improved instrument — and the result ' +
        'flips. This is exactly what a simple fixed rule could not do: not merely measure better, but ' +
        'question its own method of measuring.',
      de: 'Dies ist der entscheidende Moment der ganzen Studie. Das System erkennt: Der Fehler liegt ' +
        'nicht im Experiment, sondern im Messgerät selbst. Einen Rhythmus abzuwürgen ist etwas ' +
        'grundlegend anderes, als seinen Takt fein zu justieren — aber das alte Messgerät warf beides ' +
        'in einen Topf. Also baut das System sein eigenes Messgerät um: Es führt eine neue Größe ein, ' +
        'die eigens erfasst, ob der Rhythmus zusammenbricht (im Fachbegriff „collapsedFraction"). Ein ' +
        'zusammengebrochener Rhythmus zählt nun als eigene Kategorie und nicht länger als „starke ' +
        'Takt-Änderung". Weil jedes frühere Ergebnis mit vollständiger Herkunft gespeichert wurde, ' +
        'kann das System dieselben Messungen aus Runde 2 einfach noch einmal mit dem verbesserten ' +
        'Messgerät bewerten — und das Ergebnis kippt. Genau das ist es, was eine simple feste Regel ' +
        'nicht könnte: nicht bloß besser messen, sondern die eigene Messmethode in Frage stellen.',
    },
    note: {
      en: 'This is the second self-correction and the actual heart of the project: the AI doubts not ' +
        'its result but its own measuring instrument — and finds that a high value meant ' +
        '"strangling", not "steering".',
      de: 'Dies ist die zweite Selbstkorrektur und der eigentliche Kern des Projekts: Die KI zweifelt ' +
        'nicht am Ergebnis, sondern an ihrem eigenen Messinstrument — und stellt fest, dass ein hoher ' +
        'Wert „Abwürgen" bedeutete, nicht „Steuern".',
    },
  });

  // Station 5 — Round 3 (= the 17-55-14 core file): distributed conclusion
  const d = r2re.data.digest;
  const gKd  = findExp(d, 'gKd');
  const gCaS = findExp(d, 'gCaS');
  const gCaT = findExp(d, 'gCaT');
  const gKCa = findExp(d, 'gKCa');
  const rand = d.experiments.find(e => e.kind === 'randomDirections');

  stations.push({
    id: 'round3',
    kind: 'round',
    title: {
      en: 'Round 3 — a distributed mechanism (several controls together)',
      de: 'Runde 3 — ein verteilter Mechanismus (mehrere Regler zusammen)',
    },
    subtitle: {
      en: 'Collapse-aware measurement (v0.65), direction-free test',
      de: 'Kollaps-bewusste Messgröße (Metrik) (v0.65), richtungsfreier Test',
    },
    plainQuestion: {
      en: 'So — is there a single pacemaker after all?',
      de: 'Also — gibt es nun den einen Taktgeber?',
    },
    version: r2re.data.provenance.codeVersion,
    gitSha: r2re.data.provenance.gitSha,
    interpreter: r2re.data.provenance.interpreter,
    verdict: r2re.data.interpretation.verdict,
    explanation: {
      en: 'With the improved instrument the picture becomes clear. The two controls that previously ' +
        'looked like strong pacemakers (gKd and gCaS) are in truth no such thing — they only look so ' +
        'strong because they strangle the rhythm. They are therefore vital for a rhythm to exist at ' +
        'all, but they do not steer its pace. Two other controls (gCaT and gKCa) shift the pace ' +
        'cleanly, without breaking anything. An additional test in all directions confirms it: there ' +
        'is no single dominant pacemaker. The final result is therefore: the pace of the rhythm is ' +
        'not set by one single control, but by several together — it is spread across many shoulders.',
      de: 'Mit dem verbesserten Messgerät wird das Bild klar. Die zwei Regler, die vorher wie starke ' +
        'Taktgeber aussahen (gKd und gCaS), sind in Wahrheit gar keine — sie wirken nur deshalb so ' +
        'stark, weil sie den Rhythmus abwürgen. Sie sind also lebenswichtig dafür, dass überhaupt ein ' +
        'Rhythmus da ist, aber sie steuern nicht seinen Takt. Zwei andere Regler (gCaT und gKCa) ' +
        'verschieben den Takt dagegen sauber, ohne etwas kaputtzumachen. Ein zusätzlicher Test in ' +
        'alle Richtungen bestätigt: Es gibt keinen einzelnen dominierenden Taktgeber. Das Endergebnis ' +
        'lautet daher: Der Takt des Rhythmus wird nicht von einem einzigen Regler bestimmt, sondern ' +
        'von mehreren gemeinsam — es ist auf viele Schultern verteilt.',
    },
    plainMetricsIntro: {
      en: 'The four controls examined, at a glance. Red = only acts by strangling the rhythm (not a ' +
        'real pacemaker). Green = genuinely steers the pace cleanly.',
      de: 'Die vier untersuchten Regler auf einen Blick. Rot = wirkt nur, weil es den Rhythmus ' +
        'abwürgt (kein echter Taktgeber). Grün = steuert den Takt tatsächlich sauber.',
    },
    keyMetrics: {
      gKd:  { slopeNearZero: gKd.metrics.slopeNearZero,  collapsedFraction: gKd.metrics.collapsedFraction,
              reading: { en: 'strangles the rhythm', de: 'würgt den Rhythmus ab' } },
      gCaS: { slopeNearZero: gCaS.metrics.slopeNearZero, collapsedFraction: gCaS.metrics.collapsedFraction,
              reading: { en: 'strangles the rhythm', de: 'würgt den Rhythmus ab' } },
      gCaT: { slopeNearZero: gCaT.metrics.slopeNearZero, collapsedFraction: gCaT.metrics.collapsedFraction,
              reading: { en: 'steers the pace cleanly', de: 'steuert den Takt sauber' } },
      gKCa: { slopeNearZero: gKCa.metrics.slopeNearZero, collapsedFraction: gKCa.metrics.collapsedFraction,
              reading: { en: 'steers the pace cleanly', de: 'steuert den Takt sauber' } },
      randomDirections: rand ? {
        meanDistanceAligned: rand.metrics.meanDistanceAligned,
        meanDistanceMisaligned: rand.metrics.meanDistanceMisaligned,
      } : null,
    },
    sourceFile: publishedPath(r2re.file),
    permalink: permalink(r2re.file),
    refinedClaim: {
      en: 'Among the controls tested, gCaT and gKCa are the best candidates for smooth pace control ' +
        '(both show a real effect with no collapse at all), with gCaT the strongest of them. The ' +
        'controls that looked strongest (gKd, gCaS) are necessary for the rhythm to exist but do not ' +
        'steer its pace. Cycle period is thus controlled in a distributed way, not by a single ' +
        'pacemaker — a claim that remains open to disproof (falsifiable) by a wide, collapse-free test of gCaT.',
      de: 'Unter den geprüften Reglern sind gCaT und gKCa die besten Kandidaten für eine sanfte ' +
        'Takt-Steuerung (beide zeigen einen echten Effekt ganz ohne Zusammenbruch), wobei gCaT der ' +
        'stärkste von ihnen ist. Die scheinbar stärksten Regler (gKd, gCaS) sind notwendig dafür, dass ' +
        'überhaupt ein Rhythmus existiert, steuern aber nicht seinen Takt. Der Takt wird somit verteilt ' +
        'gesteuert, nicht von einem einzelnen Taktgeber — eine Aussage, die durch einen breiten, ' +
        'kollaps-freien Test von gCaT widerlegbar (falsifizierbar) bleibt.',
    },
  });

  return {
    generatedAt: new Date().toISOString(),
    hypothesisId: 'h6-period-control',
    title: {
      en: 'H6 — cycle-period control: two autonomous self-corrections',
      de: 'H6 — Zyklusperioden-Kontrolle: zwei autonome Selbstkorrekturen',
    },
    stations,
  };
}

// --- The core contrast: same sweeps, two metrics, inverted reading -----------
function buildContrast() {
  const r2re = loadVerdict('round2_reeval');
  const d = r2re.data.digest;
  const rows = ['gKd', 'gCaS', 'gCaT', 'gKCa'].map(name => {
    const exp = findExp(d, name);
    const collapsed = exp.metrics.collapsedFraction > 0;
    return {
      conductance: 'abpd.' + name,
      slopeNearZero: exp.metrics.slopeNearZero,
      collapsedFraction: exp.metrics.collapsedFraction,
      thresholdCrossed: exp.metrics.thresholdCrossed,
      readingSlopeOnly: {
        en: 'strong pacemaker (the first reading)',
        de: 'starker Taktgeber (so die erste Deutung)',
      },
      readingCollapseAware: collapsed
        ? { en: 'strangles the rhythm — not a pacemaker', de: 'würgt den Rhythmus ab — kein Taktgeber' }
        : { en: 'steers the pace cleanly', de: 'steuert den Takt sauber' },
      collapsed,
    };
  });
  return {
    generatedAt: new Date().toISOString(),
    version: r2re.data.provenance.codeVersion,
    gitSha: r2re.data.provenance.gitSha,
    sourceFile: publishedPath(r2re.file),
    caption: {
      en: 'One and the same measurements from round 2. Looking only at the effect strength (first ' +
        'reading), gKd and gCaS appear to be the strongest pacemakers. But once you also record ' +
        'whether the rhythm collapses in the process (second reading), the picture reverses: their ' +
        'strength comes from strangling the rhythm, not from steering the pace.',
      de: 'Ein und dieselben Messungen aus Runde 2. Sieht man nur die Effektstärke (erste ' +
        'Sichtweise), erscheinen gKd und gCaS als stärkste Taktgeber. Sobald man aber miterfasst, ob ' +
        'der Rhythmus dabei zusammenbricht (zweite Sichtweise), kehrt sich das Bild um: Ihre Stärke ' +
        'kommt vom Abwürgen des Rhythmus, nicht vom Steuern des Takts.',
    },
    rows,
  };
}

// --- The loop diagram (Figure 1): curated node explanations, bilingual ------
function buildLoop() {
  return {
    title: {
      en: 'The loop: how the system works',
      de: 'Der Kreislauf: So arbeitet das System',
    },
    intro: {
      en: 'The whole investigation runs in a repeating loop with a strict division of labour. ' +
        'Click any step to see what it does. The colour tells you who is acting: ' +
        'blue = the AI, green = the deterministic simulator, brown = the human.',
      de: 'Die ganze Untersuchung läuft in einem sich wiederholenden Kreislauf mit strikter ' +
        'Arbeitsteilung. Klicken Sie auf einen Schritt, um zu sehen, was er tut. Die Farbe zeigt, ' +
        'wer handelt: Blau = die KI, Grün = der deterministische Simulator, Braun = der Mensch.',
    },
    nodes: [
      {
        id: 'hypothesis', actor: 'human', order: 1,
        label: { en: 'Hypothesis', de: 'Hypothese' },
        title: { en: 'A hypothesis in plain text', de: 'Eine Hypothese im Klartext' },
        body: {
          en: 'Everything starts with a claim stated in ordinary language — for example, "a single ' +
            'control sets the pace of the rhythm". It is deliberately phrased strongly, so that an ' +
            'honest test has a real chance of proving it wrong.',
          de: 'Alles beginnt mit einer in gewöhnlicher Sprache formulierten Behauptung — etwa „ein ' +
            'einzelner Regler bestimmt den Takt des Rhythmus". Sie ist bewusst stark formuliert, ' +
            'damit ein ehrlicher Test eine echte Chance hat, sie zu widerlegen.',
        },
      },
      {
        id: 'transformer', actor: 'ai', order: 2,
        label: { en: 'AI proposes plan', de: 'KI schlägt Plan vor' },
        title: { en: 'The AI designs an experiment', de: 'Die KI entwirft ein Experiment' },
        body: {
          en: 'The AI receives only the hypothesis, the list of available controls, and the catalogue ' +
            'of allowed experiment types — nothing else. It returns a plan of experiments as structured ' +
            'data. It sees no internals of the simulator and computes no numbers.',
          de: 'Die KI erhält nur die Hypothese, die Liste der verfügbaren Regler und den Katalog der ' +
            'erlaubten Experimenttypen — sonst nichts. Sie liefert einen Plan von Experimenten als ' +
            'strukturierte Daten zurück. Sie sieht keine Interna des Simulators und berechnet keine Zahlen.',
        },
      },
      {
        id: 'schema', actor: 'code', order: 3,
        label: { en: 'Schema gate', de: 'Schema-Prüfung' },
        title: { en: 'Automatic plausibility check', de: 'Automatische Plausibilitätsprüfung' },
        body: {
          en: 'Before anything runs, code checks the plan strictly: unknown experiment types, ' +
            'non-existent control names, or requests that exceed fixed budgets are rejected. One single ' +
            'automatic repair attempt is allowed. This catches malformed proposals early.',
          de: 'Bevor irgendetwas läuft, prüft Code den Plan streng: unbekannte Experimenttypen, ' +
            'nicht existierende Reglernamen oder Anforderungen jenseits fester Budgets werden abgewiesen. ' +
            'Ein einziger automatischer Reparaturversuch ist erlaubt. Das fängt fehlerhafte Vorschläge ' +
            'früh ab.',
        },
      },
      {
        id: 'gate', actor: 'human', order: 4,
        label: { en: 'Human gate', de: 'Menschliches Gate' },
        title: { en: 'A person releases the plan', de: 'Ein Mensch gibt den Plan frei' },
        body: {
          en: 'This is the deliberate checkpoint. No simulation runs until a human has inspected the ' +
            'validated plan and explicitly released it. The AI can propose, but it cannot act on its own.',
          de: 'Dies ist die bewusste Kontrollstelle. Keine Simulation läuft, bevor ein Mensch den ' +
            'validierten Plan geprüft und ausdrücklich freigegeben hat. Die KI kann vorschlagen, aber ' +
            'nicht eigenmächtig handeln.',
        },
      },
      {
        id: 'runner', actor: 'code', order: 5,
        label: { en: 'Simulator runs', de: 'Simulator rechnet' },
        title: { en: 'Deterministic computation', de: 'Deterministische Berechnung' },
        body: {
          en: 'The runner executes each experiment on the simulator, exactly and repeatably. It stores ' +
            'every raw result together with its origin (software version and git revision) and then ' +
            'condenses the results into a compact set of numbers — the "digest". Every number on this ' +
            'site originates here.',
          de: 'Der Runner führt jedes Experiment auf dem Simulator aus, exakt und wiederholbar. Er ' +
            'speichert jedes Rohergebnis samt Herkunft (Softwareversion und Git-Revision) und verdichtet ' +
            'die Ergebnisse dann zu einem kompakten Satz Zahlen — dem Zahlenauszug („Digest"). Jede Zahl ' +
            'auf dieser Seite stammt von hier.',
        },
      },
      {
        id: 'interpreter', actor: 'ai', order: 6,
        label: { en: 'AI interprets', de: 'KI deutet' },
        title: { en: 'The AI reads only the digest', de: 'Die KI liest nur den Zahlenauszug' },
        body: {
          en: 'The AI now receives only the compact number digest — never the raw simulation. It ' +
            'returns a verdict (supported, refuted, or inconclusive), the evidence, and, where warranted, ' +
            'a sharper claim. That sharper claim becomes the starting point of the next round — closing ' +
            'the loop.',
          de: 'Die KI erhält jetzt nur den kompakten Zahlenauszug (Digest) — nie die Rohsimulation. Sie ' +
            'liefert ein Urteil (Verdikt: bestätigt, widerlegt oder ergebnisoffen), die Belege und, wo ' +
            'angebracht, eine geschärfte Behauptung (Claim). Diese geschärfte Behauptung wird zum ' +
            'Ausgangspunkt der nächsten Runde — und schließt den Kreislauf.',
        },
      },
    ],
    footnote: {
      en: 'The two AI steps (blue) are the only non-deterministic parts and are kept strictly apart ' +
        'from all computation. The green steps produce every number; the brown steps are where humans ' +
        'stay in control.',
      de: 'Die zwei KI-Schritte (blau) sind die einzigen nicht-deterministischen Teile und werden strikt ' +
        'von aller Berechnung getrennt gehalten. Die grünen Schritte erzeugen jede Zahl; an den braunen ' +
        'Schritten behält der Mensch die Kontrolle.',
    },
  };
}

// --- Copy the four verdicts verbatim into docs/data/sources/ -----------------
function copySources() {
  for (const key of Object.keys(KEY_VERDICTS)) {
    const file = KEY_VERDICTS[key].file;
    fs.copyFileSync(
      path.join(VERDICT_DIR, file),
      path.join(SRC_OUT_DIR, file)
    );
  }
}

// --- Main --------------------------------------------------------------------
function main() {
  if (!fs.existsSync(VERDICT_DIR)) {
    throw new Error(`Verdict directory not found: ${VERDICT_DIR}`);
  }
  fs.mkdirSync(SRC_OUT_DIR, { recursive: true });

  resolveVerdictFiles();

  const timeline = buildTimeline();
  const contrast = buildContrast();
  const loop = buildLoop();

  fs.writeFileSync(path.join(OUT_DIR, 'h6_timeline.json'), JSON.stringify(timeline, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, 'h6_contrast.json'), JSON.stringify(contrast, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, 'h6_loop.json'), JSON.stringify(loop, null, 2));
  copySources();

  console.log('Reader-site export complete (bilingual EN/DE):');
  console.log('  docs/data/h6_timeline.json   (' + timeline.stations.length + ' stations)');
  console.log('  docs/data/h6_contrast.json   (' + contrast.rows.length + ' rows)');
  console.log('  docs/data/h6_loop.json       (' + loop.nodes.length + ' loop nodes)');
  console.log('  docs/data/sources/           (' + Object.keys(KEY_VERDICTS).length + ' verdict files)');
  for (const key of Object.keys(KEY_VERDICTS)) {
    console.log('    - ' + KEY_VERDICTS[key].file);
  }
}

main();
