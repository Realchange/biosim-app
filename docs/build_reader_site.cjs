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
const TRACE_DIR   = path.join(REPO_ROOT, 'core', 'results', 'traces');
const RECOMPUTE_FILE = path.join(REPO_ROOT, 'core', 'results', 'h6-recompute', 'h6-recompute-2026-06-28T17-55-14.json');
const OUT_DIR     = path.join(__dirname, 'data');
const SRC_OUT_DIR = path.join(OUT_DIR, 'sources');
const TRACE_OUT_DIR = path.join(OUT_DIR, 'traces');

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

// Load the corrected (v0.73) digest from the recompute artifact. This carries the
// post-fix collapsedFraction and the new maxDistanceSmooth (period reach over the
// non-collapsed points only — the honest measure of pace control). The file lives in
// core/results/h6-recompute/ (gitignored, local). Returns null if absent, so the
// generator still runs without it.
function loadRecomputeDigest() {
  if (!fs.existsSync(RECOMPUTE_FILE)) return null;
  const data = JSON.parse(fs.readFileSync(RECOMPUTE_FILE, 'utf8'));
  return data.newDigest || null;
}


// The original experiment commit (provenance.gitSha) is still shown as a badge on
// each station, so scientific origin is preserved even though the clickable link
// resolves to the published copy.
function publishedPath(file) {
  return `docs/data/sources/${file}`;
}
function permalink(file) {
  return `https://github.com/${GH_OWNER}/${GH_REPO}/blob/${GH_REF}/${publishedPath(file)}`;
}
// Trace CSVs are published under docs/data/traces/ (not sources/).
function tracePublishedPath(file) {
  return `docs/data/traces/${file}`;
}
function tracePermalink(file) {
  return `https://github.com/${GH_OWNER}/${GH_REPO}/blob/${GH_REF}/${tracePublishedPath(file)}`;
}

// --- Curated station metadata (prose human-authored EN+DE; numbers injected) -
function buildTimeline() {
  const r1 = loadVerdict('round1');
  const r2raw = loadVerdict('round2_raw');
  const r2re = loadVerdict('round2_reeval');
  const r3 = loadVerdict('round3');
  const recompute = loadRecomputeDigest();  // corrected v0.73 metrics, or null

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
        'effect can mean more than one thing. It may be a smooth, controlled shift of pace — or the ' +
        'rhythm may be tipping over at the edges. On the instrument, these look the same at first: ' +
        'it could only tell "rhythm there or not there" and so conflated genuinely different things. ' +
        'The next station shows how the system sharpened the instrument — and, further down, why even ' +
        'that sharpened instrument still had to be checked against the raw traces by eye.',
      de: 'Mit der feineren Messung sehen jetzt zwei Regler (gKd und gCaS) besonders stark aus. Das ' +
        'Messgerät zeigt für beide einen kräftigen Effekt. Doch hier lauert die nächste Falle: Ein ' +
        'kräftiger Effekt kann mehr als eines bedeuten. Es kann eine sanfte, kontrollierte ' +
        'Verschiebung des Takts sein — oder der Rhythmus kippt an den Rändern. Auf dem Messgerät sieht ' +
        'beides zunächst gleich aus: Es konnte nur „Rhythmus da oder nicht da" unterscheiden und ' +
        'vermischte so tatsächlich verschiedene Dinge. Die nächste Station zeigt, wie das System das ' +
        'Messgerät schärfte — und weiter unten, warum selbst dieses geschärfte Messgerät noch von Hand ' +
        'gegen die Rohdaten geprüft werden musste.',
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
      en: 'This second self-correction — the AI doubting not its result but its own instrument — is a ' +
        'core idea of the project. But it also carries a lesson the project only fully learned later: ' +
        'a revised instrument is still an instrument, and can still misjudge. This one, it turned out, ' +
        'over-called collapse on a rhythm that was actually still running (see the trace comparison ' +
        'below). Catching that needed a human looking at the raw voltage traces by eye — which is why ' +
        'that visual check belongs in the process as a routine step, not an afterthought.',
      de: 'Diese zweite Selbstkorrektur — die KI zweifelt nicht am Ergebnis, sondern an ihrem eigenen ' +
        'Messinstrument — ist eine Kernidee des Projekts. Sie trägt aber auch eine Lehre, die das ' +
        'Projekt erst später ganz verstand: Ein überarbeitetes Messinstrument ist immer noch ein ' +
        'Messinstrument und kann weiterhin fehlurteilen. Dieses hier, so zeigte sich, meldete Kollaps ' +
        'auch dort, wo der Rhythmus in Wahrheit noch lief (siehe der Trace-Vergleich weiter unten). ' +
        'Das aufzudecken brauchte einen Menschen, der die rohen Spannungsverläufe mit eigenen Augen ' +
        'prüfte — weshalb diese visuelle Kontrolle als fester Schritt in den Prozess gehört, nicht ' +
        'als nachträglicher Einfall.',
    },
  });

  // Station 5 — Round 3 (= the 17-55-14 core file): distributed conclusion
  const d = r2re.data.digest;
  const gKd  = findExp(d, 'gKd');
  const gCaS = findExp(d, 'gCaS');
  const gCaT = findExp(d, 'gCaT');
  const gKCa = findExp(d, 'gKCa');
  const rand = d.experiments.find(e => e.kind === 'randomDirections');

  // Corrected (v0.73) metrics from the recompute, if present. These carry the
  // post-fix collapsedFraction and maxDistanceSmooth. Fall back to the stored
  // verdict values if the recompute file is absent, so the generator still runs.
  const rc = recompute;
  const rcExp = (name) => (rc ? findExp(rc, name) : null);
  const rcM = (name, field, fallback) => {
    const e = rcExp(name);
    return e && e.metrics[field] != null ? e.metrics[field] : fallback;
  };

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
      en: 'With the improved measure the picture becomes clear — but it is a different picture than ' +
        'it first seemed. The decisive column is the collapse-free pace reach: how far a control can ' +
        'move the pace without ever endangering the rhythm. Here the real order shows: gKCa steers ' +
        'most strongly, followed by gCaT and gCaS; gKd looks powerful at first glance, but its clean ' +
        'reach is the smallest of all. The controls that looked mightiest in raw terms (gKd, gCaS) ' +
        'reach their large values partly only in edge regions where the rhythm tips over — where, ' +
        'pushed hard enough, the oscillation gives way to silence or tonic firing. No single control ' +
        'dominates; an additional test in all directions confirms it. The final result: the pace is ' +
        'not set by one single control, but by several together, with different weights — spread ' +
        'across many shoulders.',
      de: 'Mit der verbesserten Messgröße wird das Bild klar — aber es ist ein anderes, als es ' +
        'zunächst schien. Die entscheidende Spalte ist die kollapsfreie Steuerreichweite: wie weit ' +
        'ein Regler den Takt verschieben kann, ohne den Rhythmus je zu gefährden. Hier zeigt sich die ' +
        'eigentliche Ordnung: gKCa steuert am stärksten, gefolgt von gCaT und gCaS; gKd wirkt auf den ' +
        'ersten Blick mächtig, aber seine saubere Steuerreichweite ist die kleinste von allen. Die ' +
        'Regler, die roh am mächtigsten aussahen (gKd, gCaS), erreichen ihre großen Werte teils nur ' +
        'in Grenzbereichen, in denen der Rhythmus kippt — wo bei starker Verstellung die Oszillation ' +
        'in Stille oder in tonisches Dauerfeuern übergeht. Kein einzelner Regler dominiert; ein ' +
        'zusätzlicher Test in alle Richtungen bestätigt das. Das Endergebnis: Der Takt wird nicht von ' +
        'einem einzigen Regler bestimmt, sondern von mehreren gemeinsam, mit unterschiedlichem ' +
        'Gewicht — er ist auf viele Schultern verteilt.',
    },
    plainMetricsIntro: {
      en: 'The four controls at a glance. The key column is the last one — the collapse-free ' +
        'pace reach: how far a control can move the pace without ever endangering the rhythm. ' +
        'It is the honest measure of pace control; the higher, the stronger the lever. gKCa is ' +
        'the strongest, gCaT and gCaS are moderate, gKd is weak — even though its raw effect ' +
        'looked large.',
      de: 'Die vier Regler auf einen Blick. Entscheidend ist die letzte Spalte — die kollapsfreie ' +
        'Steuerreichweite: wie weit ein Regler den Takt verschieben kann, ohne den Rhythmus je zu ' +
        'gefährden. Sie ist die ehrliche Maßzahl für echte Takt-Steuerung; je höher, desto stärker ' +
        'der Hebel. gKCa ist der stärkste, gCaT und gCaS sind mittel, gKd ist schwach — obwohl seine ' +
        'rohe Effektstärke groß aussah.',
    },
    keyMetrics: (() => {
      // Three-tier reading from the collapse-free reach (maxDistanceSmooth):
      // strong / moderate / weak. Data-driven so it stays correct if numbers change.
      const reachOf = {
        gKd:  rcM('gKd',  'maxDistanceSmooth', gKd.metrics.maxDistance),
        gCaS: rcM('gCaS', 'maxDistanceSmooth', gCaS.metrics.maxDistance),
        gCaT: rcM('gCaT', 'maxDistanceSmooth', gCaT.metrics.maxDistance),
        gKCa: rcM('gKCa', 'maxDistanceSmooth', gKCa.metrics.maxDistance),
      };
      const tier = (v) => {
        if (v >= 0.75) return { en: 'strong pace lever',   de: 'starker Takt-Hebel' };
        if (v >= 0.60) return { en: 'moderate pace lever', de: 'mittlerer Takt-Hebel' };
        return               { en: 'weak pace lever',     de: 'schwacher Takt-Hebel' };
      };
      const cell = (name, verdictExp) => ({
        slopeNearZero:     verdictExp.metrics.slopeNearZero,
        collapsedFraction: rcM(name, 'collapsedFraction', verdictExp.metrics.collapsedFraction),
        smoothReach:       reachOf[name],
        reading:           tier(reachOf[name]),
      });
      return {
        gKd:  cell('gKd',  gKd),
        gCaS: cell('gCaS', gCaS),
        gCaT: cell('gCaT', gCaT),
        gKCa: cell('gKCa', gKCa),
        randomDirections: rand ? {
          meanDistanceAligned: rand.metrics.meanDistanceAligned,
          meanDistanceMisaligned: rand.metrics.meanDistanceMisaligned,
        } : null,
      };
    })(),
    sourceFile: publishedPath(r2re.file),
    permalink: permalink(r2re.file),
    refinedClaim: {
      en: 'The collapse-free pace reach orders the controls clearly: gKCa steers the pace most ' +
        'strongly, gCaT and gCaS moderately, gKd most weakly. The controls that looked mightiest in ' +
        'raw terms (gKd, gCaS) reach their large values partly only in edge regions where the rhythm ' +
        'tips over; their clean control is small. Cycle period is thus controlled in a distributed ' +
        'way, not by a single pacemaker — a claim that remains open to disproof (falsifiable) by a ' +
        'wide, collapse-free test.',
      de: 'Die kollapsfreie Steuerreichweite ordnet die Regler klar: gKCa steuert den Takt am ' +
        'stärksten, gCaT und gCaS mittel, gKd am schwächsten. Die Regler, die roh am mächtigsten ' +
        'aussahen (gKd, gCaS), erreichen ihre großen Werte teils nur in Grenzbereichen, in denen der ' +
        'Rhythmus kippt; ihre saubere Steuerung ist gering. Der Takt wird somit verteilt gesteuert, ' +
        'nicht von einem einzelnen Taktgeber — eine Aussage, die durch einen breiten, kollapsfreien ' +
        'Test widerlegbar (falsifizierbar) bleibt.',
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
        ? { en: 'looked like collapse (round-2 reading)', de: 'schien Kollaps zu sein (Deutung aus Runde 2)' }
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
        'reading), gKd and gCaS appear to be the strongest pacemakers. The round-2 revision then read ' +
        'their large values as collapse (second reading) — a real step forward at the time. But this ' +
        'reading was itself still too coarse: as the voltage traces below show, much of what it called ' +
        'collapse was a rhythm that kept running. The honest measure is the collapse-free reach in the ' +
        'table above, not this binary.',
      de: 'Ein und dieselben Messungen aus Runde 2. Sieht man nur die Effektstärke (erste Sichtweise), ' +
        'erscheinen gKd und gCaS als stärkste Taktgeber. Die Revision aus Runde 2 deutete ihre großen ' +
        'Werte dann als Kollaps (zweite Sichtweise) — ein echter Fortschritt damals. Doch diese Deutung ' +
        'war selbst noch zu grob: Wie die Spannungsverläufe weiter unten zeigen, war vieles, was sie ' +
        'Kollaps nannte, ein weiterlaufender Rhythmus. Die ehrliche Maßzahl ist die kollapsfreie ' +
        'Steuerreichweite in der Tabelle oben, nicht diese Zweiteilung.',
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

// --- Voltage traces (Figure 2): parse real CSV exports from the simulator ----
// The CLI src/hypothesis/cli-export-trace.ts writes reference.csv and
// collapsed.csv into core/results/traces/. Each carries provenance in # comment
// lines. We parse them into a compact JSON the reader page draws as SVG. Numbers
// come straight from the simulator; only the captions are human-authored.
function parseTraceCsv(file) {
  const raw = fs.readFileSync(path.join(TRACE_DIR, file), 'utf8');
  const meta = {};
  const rows = [];
  let headerSeen = false;
  for (const line of raw.split(/\r?\n/)) {
    if (line.startsWith('#')) {
      line.slice(1).trim().split(/\s+/).forEach(tok => {
        const m = tok.match(/^([A-Za-z.]+)=(.+)$/);
        if (m) meta[m[1]] = m[2];
      });
      continue;
    }
    if (!line.trim()) continue;
    if (!headerSeen) { headerSeen = true; continue; }  // skip "t_ms,v_abpd,v_lp,v_py"
    const p = line.split(',').map(Number);
    if (p.length === 4 && p.every(Number.isFinite)) rows.push(p);
  }
  return { meta, rows };
}

function buildTraces() {
  const refFile = 'reference.csv';
  const colFile = 'collapsed.csv';
  const ref = parseTraceCsv(refFile);
  const col = parseTraceCsv(colFile);

  // Series as parallel arrays keep the JSON small.
  const pack = (parsed) => ({
    t:     parsed.rows.map(r => r[0]),
    abpd:  parsed.rows.map(r => r[1]),
    lp:    parsed.rows.map(r => r[2]),
    py:    parsed.rows.map(r => r[3]),
  });

  return {
    generatedAt: new Date().toISOString(),
    cells: [
      { key: 'abpd', label: 'AB/PD' },
      { key: 'lp',   label: 'LP' },
      { key: 'py',   label: 'PY' },
    ],
    scaleBarMv: 25,
    reference: {
      series: pack(ref),
      version: ref.meta.version,
      gitSha: ref.meta.gitSha,
      noise: ref.meta.noise,
      durationMs: Number(ref.meta.durationMs),
      sourceFile: tracePublishedPath(refFile),
      permalink: tracePermalink(refFile),
      title: {
        en: 'Intact reference rhythm',
        de: 'Intakter Referenzrhythmus',
      },
      caption: {
        en: 'The three cells fire in the fixed order AB/PD → LP → PY — the healthy ' +
          'triphasic pyloric rhythm. This is what the simulator produces at the reference ' +
          'settings; every later experiment is compared against it.',
        de: 'Die drei Zellen feuern in der festen Reihenfolge AB/PD → LP → PY — der gesunde ' +
          'dreiphasige pylorische Rhythmus. Das erzeugt der Simulator bei den Referenz-' +
          'Einstellungen; jedes spätere Experiment wird damit verglichen.',
      },
    },
    collapsed: {
      series: pack(col),
      version: col.meta.version,
      gitSha: col.meta.gitSha,
      noise: col.meta.noise,
      durationMs: Number(col.meta.durationMs),
      collapseParam: col.meta.collapse,       // e.g. "abpd.gKd"
      logfactor: Number(col.meta.logfactor),  // e.g. -2
      collapsed: col.meta.collapsed === 'true',
      sourceFile: tracePublishedPath(colFile),
      permalink: tracePermalink(colFile),
      title: {
        en: 'A genuine collapse (AB/PD silenced)',
        de: 'Ein echter Kollaps (AB/PD verstummt)',
      },
      caption: {
        en: 'This is what a real collapse looks like — for comparison. Here the pacemaker cell AB/PD ' +
          'has its sodium conductance gNa turned right down, so it can no longer fire action ' +
          'potentials: it produces no spikes at all (it still shows faint slow-wave wobbles, but the ' +
          'pacemaker is silent). LP and PY keep firing, but with the pacemaker gone the ordered ' +
          'three-phase rhythm is genuinely lost — eye and metric agree. Contrast this with the "reduce ' +
          'gKd" case that the round-2 metric wrongly called collapse: there the rhythm kept running. ' +
          'Note this uses a different control (gNa) than the H6 sweeps — it illustrates what collapse ' +
          'IS, not the outcome of an H6 experiment.',
        de: 'So sieht ein echter Kollaps aus — zum Vergleich. Hier ist bei der Schrittmacherzelle ' +
          'AB/PD die Natrium-Leitfähigkeit gNa weit heruntergedreht, sodass sie keine ' +
          'Aktionspotentiale mehr bilden kann: Sie erzeugt gar keine Spikes (man sieht noch schwache ' +
          'langsame Wellen, aber der Schrittmacher ist stumm). LP und PY feuern weiter, doch ohne den ' +
          'Schrittmacher ist der geordnete Dreiphasen-Rhythmus wirklich verloren — Auge und Metrik ' +
          'sind sich einig. Das steht im Gegensatz zum „gKd reduzieren"-Fall, den die Metrik aus ' +
          'Runde 2 fälschlich Kollaps nannte: Dort lief der Rhythmus weiter. Beachten Sie: Hier wird ' +
          'ein anderer Regler (gNa) verstellt als in den H6-Messreihen — es zeigt, was Kollaps ' +
          'überhaupt IST, nicht das Ergebnis eines H6-Experiments.',
      },
    },
    contrastNote: {
      en: 'Left: the intact reference rhythm. Right: a genuine collapse, where the pacemaker AB/PD is ' +
        'silenced. Seeing a real collapse side by side with the healthy rhythm is what made the metric ' +
        'flaw visible: the round-2 metric had been calling some still-running rhythms "collapse" too, ' +
        'and only looking at the actual voltage traces revealed the difference. The lesson for the ' +
        'workflow: inspecting the raw traces by eye is a routine check, not an optional extra — a ' +
        'metric, however carefully revised, can still misjudge without it showing in the numbers.',
      de: 'Links: der intakte Referenzrhythmus. Rechts: ein echter Kollaps, bei dem der Schrittmacher ' +
        'AB/PD verstummt. Erst ein echter Kollaps neben dem gesunden Rhythmus machte den Metrik-Fehler ' +
        'sichtbar: Die Metrik aus Runde 2 hatte auch manche weiterlaufenden Rhythmen „Kollaps" genannt, ' +
        'und erst der Blick auf die tatsächlichen Spannungsverläufe zeigte den Unterschied. Die Lehre ' +
        'für den Arbeitsprozess: Die rohen Verläufe mit eigenen Augen zu prüfen ist ein fester ' +
        'Kontrollschritt, kein optionaler Zusatz — eine Messgröße kann, so sorgfältig sie auch ' +
        'überarbeitet wurde, weiterhin fehlurteilen, ohne dass es in den Zahlen auffällt.',
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

  // Voltage traces are optional: only build if the CSV exports are present.
  let traceInfo = 'skipped (no core/results/traces/reference.csv)';
  const refCsv = path.join(TRACE_DIR, 'reference.csv');
  const colCsv = path.join(TRACE_DIR, 'collapsed.csv');
  if (fs.existsSync(refCsv) && fs.existsSync(colCsv)) {
    const traces = buildTraces();
    fs.writeFileSync(path.join(OUT_DIR, 'h6_traces.json'), JSON.stringify(traces));
    // Publish the raw CSVs verbatim (full transparency, like the verdict sources).
    fs.mkdirSync(TRACE_OUT_DIR, { recursive: true });
    fs.copyFileSync(refCsv, path.join(TRACE_OUT_DIR, 'reference.csv'));
    fs.copyFileSync(colCsv, path.join(TRACE_OUT_DIR, 'collapsed.csv'));
    traceInfo = `${traces.reference.series.t.length} + ${traces.collapsed.series.t.length} samples, ` +
      `2 CSVs published`;
  }

  console.log('Reader-site export complete (bilingual EN/DE):');
  console.log('  docs/data/h6_timeline.json   (' + timeline.stations.length + ' stations)');
  console.log('  docs/data/h6_contrast.json   (' + contrast.rows.length + ' rows)');
  console.log('  docs/data/h6_loop.json       (' + loop.nodes.length + ' loop nodes)');
  console.log('  docs/data/h6_traces.json     (' + traceInfo + ')');
  console.log('  docs/data/sources/           (' + Object.keys(KEY_VERDICTS).length + ' verdict files)');
  for (const key of Object.keys(KEY_VERDICTS)) {
    console.log('    - ' + KEY_VERDICTS[key].file);
  }
}

main();
