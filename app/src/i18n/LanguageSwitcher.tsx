import { useI18n, useT } from './index'
import type { Lang } from './index'

// Compact EN/DE toggle for the header.
export function LanguageSwitcher() {
  const lang = useI18n(s => s.lang)
  const setLang = useI18n(s => s.setLang)
  const t = useT()

  const btn = (l: Lang, label: string) => (
    <button
      onClick={() => setLang(l)}
      aria-pressed={lang === l}
      style={{
        background: lang === l ? '#30363d' : 'transparent',
        color: lang === l ? '#f0f6fc' : '#8b949e',
        border: '1px solid #30363d',
        borderRadius: 4,
        padding: '3px 7px',
        fontSize: 11,
        cursor: 'pointer',
        fontWeight: lang === l ? 600 : 400,
      }}
    >
      {label}
    </button>
  )

  return (
    <span style={{ display: 'inline-flex', gap: 2 }} title={t.lang.switchTitle}>
      {btn('en', 'EN')}
      {btn('de', 'DE')}
    </span>
  )
}
