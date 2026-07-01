// Pedagogical explanations + parameter tips for each preset, keyed by preset name
// (the stable identifier from @biosim/core). Localized content lives in info.de.ts
// and info.en.ts; this module exposes the shared types and the language hook.
import { useI18n } from '../i18n'
import { PRESET_INFO_DE } from './info.de'
import { PRESET_INFO_EN } from './info.en'

export interface PresetTip { param: string; effect: string }
export interface ComparePoint { ok: boolean; text: string }
// Optional comparison: our simulation vs. the reference simulator vs. a biological recording.
export interface PresetComparison {
  intro: string
  simImg: string
  refImg: string
  refCaption: string
  litImg: string
  litCaption: string
  litHref: string
  points: ComparePoint[]
}
export interface Citation {
  role: string          // e.g. "Original model", "Simulator"
  requested?: boolean   // authors explicitly ask for this one to be cited
  text: string          // human-readable reference
  doi?: string
  bibtex: string
}
export interface PresetInfo {
  name: string          // localized display name for the preset
  summary: string
  tips: PresetTip[]
  comparison?: PresetComparison
  citations?: Citation[]
}

const DICTS: Record<'en' | 'de', Record<string, PresetInfo>> = {
  en: PRESET_INFO_EN,
  de: PRESET_INFO_DE,
}

// Reactive hook: preset info in the current language.
export function usePresetInfo(): Record<string, PresetInfo> {
  const lang = useI18n(s => s.lang)
  return DICTS[lang]
}
