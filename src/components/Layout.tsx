import { useEffect } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { useApp, type ThemeSetting } from '../app/appContext'
import { IS_DEMO_BUILD } from '../app/env'
import { useLocalStatus } from '../app/queries'
import { Icon } from './Icon'
import { SearchBox } from './SearchBox'
import { Notice } from './States'

const THEME_ORDER: ThemeSetting[] = ['system', 'light', 'dark']
const THEME_LABEL: Record<ThemeSetting, string> = {
  system: 'OS の設定',
  light: 'ライト',
  dark: 'ダーク',
}

function ThemeToggle() {
  const { themeSetting, setThemeSetting } = useApp()
  const next = THEME_ORDER[(THEME_ORDER.indexOf(themeSetting) + 1) % THEME_ORDER.length] ?? 'system'
  const icon = themeSetting === 'light' ? 'sun' : themeSetting === 'dark' ? 'moon' : 'monitor'
  return (
    <button
      type="button"
      className="btn btn--ghost btn--icon"
      onClick={() => setThemeSetting(next)}
      aria-label={`表示テーマ: ${THEME_LABEL[themeSetting]}（押すと${THEME_LABEL[next]}に切り替え）`}
      title={`表示テーマ: ${THEME_LABEL[themeSetting]}`}
    >
      <Icon name={icon} />
    </button>
  )
}

function SourceControl() {
  const { sourceKind, setSourceKind } = useApp()
  if (IS_DEMO_BUILD) {
    return (
      <span className="source-badge" data-testid="demo-badge">
        デモ（架空データ）
      </span>
    )
  }
  return (
    <div className="segmented" role="group" aria-label="データの取得元">
      <button
        type="button"
        aria-pressed={sourceKind === 'jquants'}
        onClick={() => setSourceKind('jquants')}
      >
        J-Quants
      </button>
      <button
        type="button"
        aria-pressed={sourceKind === 'demo'}
        onClick={() => setSourceKind('demo')}
      >
        デモ
      </button>
    </div>
  )
}

function SetupBanner() {
  const { sourceKind } = useApp()
  const status = useLocalStatus()
  const location = useLocation()
  // Home and stock pages show the same guidance in their error state.
  if (IS_DEMO_BUILD || sourceKind !== 'jquants' || location.pathname !== '/compare') return null
  if (status.data === undefined || status.data.apiKeyConfigured) return null
  return (
    <div className="container" style={{ paddingTop: 16 }}>
      <Notice tone="warn">
        J-Quants の API キーが設定されていません。<Link to="/setup">セットアップ手順</Link>
        を確認するか、右上でデモデータに切り替えてください。
      </Notice>
    </div>
  )
}

export function Layout() {
  const location = useLocation()
  const isHome = location.pathname === '/'

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  return (
    <>
      {/* Hash routing: a plain #main link would be read as a route, so move focus manually. */}
      <a
        className="skip-link"
        href="#main"
        onClick={(event) => {
          event.preventDefault()
          document.getElementById('main')?.focus()
        }}
      >
        本文へスキップ
      </a>
      <header className="app-header">
        <div className="container app-header__inner">
          <Link to="/" className="brand" aria-label="Market Lens ホーム">
            <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
              <rect width="32" height="32" rx="8" fill="#1c5cab" />
              <path
                d="M7 21l5-6 4 3 6-8 3 3"
                fill="none"
                stroke="#fff"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Market Lens
          </Link>
          <nav className="nav" aria-label="メイン">
            <NavLink to="/" end>
              銘柄を調べる
            </NavLink>
            <NavLink to="/compare">比較</NavLink>
            <NavLink to="/about">このツールについて</NavLink>
          </nav>
          {!isHome && (
            <div className="header-search">
              <SearchBox testId="header-search" />
            </div>
          )}
          <div className="header-tools">
            <SourceControl />
            <ThemeToggle />
          </div>
        </div>
      </header>
      <SetupBanner />
      <main id="main" tabIndex={-1}>
        <div className="container">
          <Outlet />
        </div>
      </main>
      <footer className="app-footer">
        <div className="container stack">
          <p>
            Market Lens
            は個人学習用の非公式ツールです。表示内容は投資助言ではなく、正確性を保証しません。
          </p>
          <p>
            {IS_DEMO_BUILD
              ? 'この公開版は架空のデモデータだけを表示しています。実在の企業・株価ではありません。'
              : 'J-Quants のデータは、あなたの API キーで取得し、この PC の中だけで扱います。'}{' '}
            <Link to="/about">データの扱いと利用条件</Link>
          </p>
        </div>
      </footer>
    </>
  )
}
