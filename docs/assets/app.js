/* BIOSIM H6 reader page — vanilla JS, no build step, no dependencies.
   Bilingual EN/DE. English is the default; German on click. */

const NUM = (x) => (typeof x === 'number' ? x.toFixed(3).replace(/\.?0+$/, '') : x);

let LANG = 'en';                 // current language
let timelineData = null;
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
    en: 'The original error: a high measured value ("steep curve") was read as "strong pacemaker". ' +
        'But for two of the four controls it meant the opposite — the rhythm was collapsing. A ' +
        'collapsing rhythm is not a fine adjustment of pace but a strangling. Switch between the ' +
        'old and new points of view with the two buttons and watch the last column:',
    de: 'Der ursprüngliche Fehler: Ein hoher Messwert („steile Kurve") wurde als „starker Taktgeber" ' +
        'gedeutet. Tatsächlich bedeutete er bei zwei der vier Regler aber das Gegenteil — der Rhythmus ' +
        'brach zusammen. Ein zusammenbrechender Rhythmus ist eben kein feines Justieren des Takts, ' +
        'sondern ein Abwürgen. Schalten Sie mit den beiden Knöpfen zwischen der alten und der neuen ' +
        'Sichtweise um und beobachten Sie die letzte Spalte:',
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
  h_refined: { en: 'The new, sharpened finding', de: 'Der neue, geschärfte Befund' },
  h_source: { en: 'Source file', de: 'Quelldatei' },
  col_ctrl_short: { en: 'Control', de: 'Regler' },
  col_effect_short: { en: 'Effect strength', de: 'Effektstärke' },
  col_collapse_short: { en: 'Collapse?', de: 'Kollaps?' },
  verdict_refuted: { en: 'refuted', de: 'widerlegt' },
  verdict_supported: { en: 'supported', de: 'bestätigt' },
  source_view: { en: '\u2197 view on GitHub', de: '\u2197 auf GitHub ansehen' },
  refined_hint: {
    en: 'Plain-language summary of the AI\u2019s verdict. The verbatim original is in the linked source file.',
    de: 'Verständliche Zusammenfassung des KI-Urteils (Verdikt). Der wörtliche Originaltext steht in der verlinkten Quelldatei.',
  },
  trace_contrast_h2: {
    en: 'What "collapse" actually looks like',
    de: 'Wie ein „Kollaps" tatsächlich aussieht',
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
       There are 31 of these controls in total. The central question of this study is:
       <strong>which control actually sets the pace of the rhythm?</strong> Is there one decisive
       pacemaker, or do many work together?</p>
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
       strength of the AI. And as the following case study shows, the AI can even do something one
       would hardly credit it with: <strong>notice that its own procedure was flawed, and correct it
       itself.</strong> That is exactly what is traceable, step by step, below.</p>
    <p class="primer-guide">Below you see the process in five stations. Click each one to see what
       the system thought, did and found out. Two of the stations are <strong>self-corrections</strong>
       — the moments in which the AI recognised its own mistake.</p>
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
       solcher Regler. Die zentrale Frage dieser Studie lautet: <strong>Welcher Regler bestimmt
       eigentlich den Takt des Rhythmus?</strong> Gibt es den einen entscheidenden Taktgeber, oder
       arbeiten viele zusammen?</p>
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
       trotzdem die kreative Stärke der KI nutzt. Und wie die folgende Fallstudie zeigt, kann die KI
       sogar etwas, das man ihr kaum zutraut: <strong>bemerken, dass ihr eigenes Vorgehen fehlerhaft
       war, und es selbst korrigieren.</strong> Genau das ist unten Schritt für Schritt
       nachvollziehbar.</p>
    <p class="primer-guide">Unten sehen Sie den Ablauf in fünf Stationen. Klicken Sie jede an, um zu
       sehen, was das System gedacht, getan und herausgefunden hat. Zwei der Stationen sind
       <strong>Selbstkorrekturen</strong> — die Momente, in denen die KI ihren eigenen Fehler
       erkannte.</p>
  `,
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

  // Primer block
  document.getElementById('primer-card').innerHTML = PRIMER[LANG];

  // Loop diagram
  if (loopData) renderLoop(loopData);

  // Voltage traces
  if (traceData) renderTraces();

  // Build-meta line
  if (timelineData) {
    document.getElementById('build-meta').textContent =
      `${t(UI.build_meta)}: ${timelineData.generatedAt.slice(0, 10)} · ${timelineData.hypothesisId}`;
  }

  // Re-render the data-driven parts in the new language
  if (timelineData) renderTimeline(timelineData);
  if (contrastData) {
    document.getElementById('contrast-caption').textContent = t(contrastData.caption);
    document.getElementById('contrast-provenance').textContent =
      `${t({en:'Source',de:'Quelle'})}: ${contrastData.sourceFile} · v${contrastData.version} · ${contrastData.gitSha}`;
    setMode(contrastMode);
  }

  // Toggle button active states
  document.getElementById('lang-en').classList.toggle('active', LANG === 'en');
  document.getElementById('lang-de').classList.toggle('active', LANG === 'de');
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

function renderKeyMetrics(km, intro) {
  const wrap = el('div');
  wrap.appendChild(el('h4', null, t(UI.h_controls)));
  if (intro) wrap.appendChild(el('p', 'metrics-intro', intro));
  const table = el('table', 'mini-table');
  table.innerHTML = `
    <thead><tr>
      <th>${t(UI.col_ctrl_short)}</th>
      <th>${t(UI.col_effect_short)}<span class="th-sub">slopeNearZero</span></th>
      <th>${t(UI.col_collapse_short)}<span class="th-sub">collapsedFraction</span></th>
      <th>${t(UI.col_reading)}</th>
    </tr></thead>
    <tbody></tbody>`;
  const tb = table.querySelector('tbody');
  for (const [name, m] of Object.entries(km)) {
    if (name === 'randomDirections') continue;
    const collapse = m.collapsedFraction > 0;
    const tr = el('tr');
    tr.innerHTML =
      `<td>abpd.${name}</td>` +
      `<td class="num">${NUM(m.slopeNearZero)}</td>` +
      `<td class="num">${NUM(m.collapsedFraction)}</td>` +
      `<td class="${collapse ? 'reading-collapse' : 'reading-smooth'}">${t(m.reading)}</td>`;
    tb.appendChild(tr);
  }
  wrap.appendChild(table);
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

(async function () {
  wireLanguageButtons();
  try {
    const [timeline, contrast, loop] = await Promise.all([
      loadJSON('data/h6_timeline.json'),
      loadJSON('data/h6_contrast.json'),
      loadJSON('data/h6_loop.json'),
    ]);
    timelineData = timeline;
    contrastData = contrast;
    loopData = loop;

    // Voltage traces are optional — load separately so a missing file
    // never blocks the rest of the page.
    try {
      traceData = await loadJSON('data/h6_traces.json');
    } catch (e) {
      traceData = null;
      // hide the trace sections if no data
      ['trace-intro', 'trace-contrast'].forEach(id => {
        const n = document.getElementById(id);
        if (n) n.style.display = 'none';
      });
    }

    renderContrast(contrast);
    applyLanguage();     // renders timeline + primer + loop + traces + static strings in EN
  } catch (err) {
    document.getElementById('timeline').innerHTML =
      `<p style="color:#a23b2d">Error loading data: ${err.message}<br>` +
      `Is the page served over http:// (not file://)? fetch needs a local server.</p>`;
    console.error(err);
  }
})();
