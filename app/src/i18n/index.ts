import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { en } from './messages/en'
import type { Messages } from './messages/en'
import { de } from './messages/de'

export type Lang = 'en' | 'de'
export type { Messages }

// Default to English (international audience); German available via the switcher.
const DICTS: Record<Lang, Messages> = { en, de }

interface I18nState {
  lang: Lang
  setLang: (lang: Lang) => void
}

export const useI18n = create<I18nState>()(
  persist(
    set => ({
      lang: 'en',
      setLang: lang => set({ lang }),
    }),
    { name: 'biosim-lang' },
  ),
)

// Reactive hook: returns the message dictionary for the current language.
export function useT(): Messages {
  const lang = useI18n(s => s.lang)
  return DICTS[lang]
}

// Non-reactive accessor (for class components / non-React code).
export function getMessages(): Messages {
  return DICTS[useI18n.getState().lang]
}
