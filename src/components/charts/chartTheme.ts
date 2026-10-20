/**
 * Chart colors. Categorical slots and their order come from the validated
 * reference palette (checked with the dataviz palette validator, light & dark):
 * - comparison lines use slots 1–4 (adjacent-pair CVD ΔE ≥ 8.4 in both modes)
 * - moving averages use slots 1–2 (all-pairs CVD ΔE ≥ 24.7)
 * Candles are ink, not hue: up = hollow, down = filled (works without color).
 */
export type ResolvedTheme = 'light' | 'dark'

export type ChartTheme = {
  surface: string
  text: string
  text2: string
  muted: string
  grid: string
  axis: string
  candle: string
  volume: string
  series: [string, string, string, string]
  /** Diverging scale for correlations: negative pole, neutral midpoint, positive pole. */
  diverging: { negative: string; mid: string; positive: string }
  tooltipBg: string
  tooltipBorder: string
}

export const CHART_THEMES: Record<ResolvedTheme, ChartTheme> = {
  light: {
    surface: '#fcfcfb',
    text: '#0b0b0b',
    text2: '#52514e',
    muted: '#898781',
    grid: '#e1e0d9',
    axis: '#c3c2b7',
    candle: '#3d3c39',
    volume: '#b9b8b0',
    series: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100'],
    diverging: { negative: '#2a78d6', mid: '#f0efec', positive: '#e34948' },
    tooltipBg: '#fcfcfb',
    tooltipBorder: 'rgba(11,11,11,0.12)',
  },
  dark: {
    surface: '#1a1a19',
    text: '#f0efec',
    text2: '#c3c2b7',
    muted: '#898781',
    grid: '#2c2c2a',
    axis: '#383835',
    candle: '#d6d5cf',
    volume: '#55544f',
    series: ['#3987e5', '#d95926', '#199e70', '#c98500'],
    diverging: { negative: '#3987e5', mid: '#383835', positive: '#e66767' },
    tooltipBg: '#232321',
    tooltipBorder: 'rgba(255,255,255,0.14)',
  },
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number]
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`
}

function mix(a: string, b: string, t: number): string {
  const ca = hexToRgb(a)
  const cb = hexToRgb(b)
  return rgbToHex(
    [0, 1, 2].map((i) => (ca[i] ?? 0) + ((cb[i] ?? 0) - (ca[i] ?? 0)) * t) as [
      number,
      number,
      number,
    ],
  )
}

/** Color for a correlation in [-1, 1]: gray at 0, toward the poles at ±1. */
export function divergingColor(theme: ChartTheme, value: number): string {
  const t = Math.max(-1, Math.min(1, value))
  return t < 0
    ? mix(theme.diverging.mid, theme.diverging.negative, -t)
    : mix(theme.diverging.mid, theme.diverging.positive, t)
}

/** Relative luminance (WCAG). */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Black or white text, whichever contrasts more with the fill. */
export function inkOn(fill: string): string {
  const l = luminance(fill)
  const onBlack = (l + 0.05) / 0.05
  const onWhite = 1.05 / (l + 0.05)
  return onBlack >= onWhite ? '#0b0b0b' : '#ffffff'
}

/** Escapes text before it goes into tooltip HTML (company names come from the API). */
export function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
