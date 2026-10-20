type IconName =
  | 'search'
  | 'star'
  | 'starFilled'
  | 'plus'
  | 'refresh'
  | 'close'
  | 'info'
  | 'alert'
  | 'sun'
  | 'moon'
  | 'monitor'
  | 'logo'
  | 'compare'

const PATHS: Record<IconName, string> = {
  search: 'M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Zm5.3-2.2L21 21',
  star: 'm12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9L12 3.5Z',
  starFilled: 'm12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9L12 3.5Z',
  plus: 'M12 5v14M5 12h14',
  refresh: 'M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5',
  close: 'M6 6l12 12M18 6 6 18',
  info: 'M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20Zm0-11v6m0-9.5v.5',
  alert: 'M12 3 2 20h20L12 3Zm0 6v5m0 3v.5',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0-15v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z',
  monitor: 'M3 4h18v12H3zM8 20h8m-4-4v4',
  logo: 'M4 17l5-6 4 3 7-8',
  compare: 'M4 19V9m6 10V5m6 14v-7m4 7H2',
}

export function Icon({
  name,
  size = 20,
  label,
}: {
  name: IconName
  size?: number
  /** When given, the icon is announced; otherwise it is decorative. */
  label?: string
}) {
  const filled = name === 'starFilled'
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label === undefined ? undefined : 'img'}
      aria-label={label}
      aria-hidden={label === undefined ? true : undefined}
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
