# Editor — Phase A (Editor-UX & Platzierung)

Status: approved design (2026-06-26). Scope: **Phase A only**. Phase B (graduierte
synaptische Übertragung des nicht-spikenden Neurons) folgt als eigene Spezifikation.

## Ziel

Im Editor-Modus soll der Nutzer ein Netzwerk von Grund auf bauen können: leeres
Canvas, eine Palette mit Platzier-Werkzeugen für drei Neuron-Typen, und ein
Modell-Auswahlfeld. Auswählen/Verbinden/Messen bleibt ungestört möglich.

## Begriffe → Modell-Abbildung

- **Spikend**: spikendes Neuron. `model: 'hodgkin-huxley'` (Standard) oder `'lif'`
  (wählbar; später zusätzlich `'swim'`).
- **Afferenz**: spikendes Neuron als Eingangsquelle. Wie *Spikend* (HH/LIF), zusätzlich
  `kind: 'afferent'` — nur Optik/Bedeutung, keine eigene Simulationslogik.
- **Nicht-spikend**: `model: 'graded'`. In Phase A ein **Leaky-Integrator ohne Schwelle**:
  integriert Eingänge, zeigt sein Membranpotential, **feuert nie** und **treibt (noch)
  keine** nachgeschalteten Neurone. Die graduierte Übertragung kommt in Phase B.

## 1. Einstieg & Leeren

- Klick auf den Modus-Button „Editor":
  - Sind Neurone vorhanden → native Rückfrage „Canvas leeren?" (`confirm`). Ja →
    `clearNetwork()` (leeres Netz). Abbrechen → aktuelles Netz bleibt, Modus wird
    trotzdem auf „Editor" gesetzt (man editiert das vorhandene Netz weiter).
  - Leer → direkt Editor-Modus, Canvas bleibt leer.
- Neue Store-Aktion `clearNetwork()`: leert neurons, synapses, electrodes, traces,
  currentTraces, selectedId, activity. Behält Modus & simulationParams.

## 2. Palette & Werkzeuge

- Store: `editorTool: 'select' | 'spiking' | 'nonspiking' | 'afferent'` (Default
  `'select'`); `editorModel: 'hodgkin-huxley' | 'lif'` (Default `'hodgkin-huxley'`).
  Aktionen `setEditorTool`, `setEditorModel`. Beim Verlassen des Editor-Modus →
  `editorTool` zurück auf `'select'`.
- Palette-Komponente, nur im Editor-Modus sichtbar (im Parameter-Panel oben):
  - **🖱 Auswählen** (Default), **⚡ Spikend**, **○ Nicht-spikend**, **▷ Afferenz**.
  - Aktives Werkzeug hervorgehoben.
  - **Modell**: Auswahlfeld HH / LIF (wirkt auf neu platzierte Spikend-/Afferenz-Neurone).
    Bei aktivem Nicht-spikend-Werkzeug deaktiviert/ausgegraut.

## 3. Datenmodell

- `Neuron.model`: `'lif' | 'hodgkin-huxley' | 'graded'`.
- `Neuron.kind?: 'afferent'` (optional, nur Optik/Intent).
- `addNeuron(pos, model, kind?)` — erweitert um `kind`; setzt Default-Parameter passend
  zum Modell (`DEFAULT_HH_PARAMS` / `DEFAULT_LIF_PARAMS`; graded nutzt LIF-artige Parameter).
- `DEFAULT_GRADED_PARAMS` (LIF-förmig: E_rest, R_m, tau_m, I_stim; ohne V_threshold-Wirkung).

## 4. Platzier-Interaktion (NetworkCanvas)

- Klick auf **leeres Canvas** (Hintergrund):
  - `editorTool` ist ein Platzier-Werkzeug → `addNeuron(klickPos, modell, kind)`. Werkzeug
    bleibt aktiv (Mehrfach-Setzen). `spiking`/`afferent` → `editorModel`; `nonspiking` → `'graded'`.
  - sonst (`'select'`) → Auswahl aufheben (bisheriges Verhalten).
- Bisheriges **Doppelklick-zum-Platzieren entfällt** (durch Werkzeuge ersetzt).
- Klick auf ein Neuron/Kompartiment:
  - `editorTool === 'select'` → bisheriges Verhalten (auswählen, Shift = Synapse ziehen,
    Kompartiment-Klick = Elektrode setzen).
  - Platzier-Werkzeug aktiv → nur auswählen (`setSelected`), **kein** Elektroden-Setzen,
    **kein** versehentliches Platzieren auf dem Neuron.
- Verschieben (Drag) und Löschen (Entf) bleiben in allen Werkzeugen erhalten.

## 5. Simulation (graded, Phase A)

- `networkStep`: neuer Zweig `model === 'graded'`: Leaky-Integrator
  `dV = (dt/tau_m)·(E_rest − V + R_m·(I_stim + I_syn))`, keine Schwelle, kein Spike,
  `spikes[id] = false`. Setzt `voltages[id] = V` und `compartments` (Soma = V; Dendriten
  über das bestehende passive Kabel, damit Elektroden/Optik funktionieren).
- **Keine** synaptische Ausgabe von graded-Neuronen in Phase A (Phase B).
- Spikend/Afferenz: unveränderte LIF-/HH-Pfade.

## 6. Optik (NeuronSVG)

- `model === 'graded'`: Soma mit **gestricheltem** Umriss (Signal „kein Spike"); blitzt
  nie rot (Soma-Füllung folgt der Spannung, aber Overshoot-Rot entfällt).
- `kind === 'afferent'`: kleines **Eingangs-Dreieck** links am Soma (Sensor-Markierung).
- Spikend (HH/LIF): unverändert.

## 7. Tests

- Store: `setEditorTool`/`setEditorModel` setzen Werte; `clearNetwork` leert alles Nötige;
  `addNeuron` mit Modell+kind erzeugt korrektes Neuron; Modus-Wechsel weg vom Editor setzt
  Werkzeug zurück.
- Simulation: graded-Neuron integriert Eingang und **feuert nie** (`spikes` immer false);
  zeigt eine messbare Spannungsänderung bei Reiz.
- NetworkCanvas: bei aktivem Platzier-Werkzeug erzeugt ein Hintergrund-Klick ein Neuron des
  passenden Typs/Modells; bei `'select'` nicht.

## Nicht in Phase A (→ Phase B)

- Graduierte synaptische Übertragung (graded-Quelle treibt Ziel proportional zu V).
- SWIM-Modell als dritte Spikend-Option.
