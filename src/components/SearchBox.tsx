import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router'
import { useApp } from '../app/appContext'
import { useListings } from '../app/queries'
import type { Listing } from '../lib/data/types'
import { normalizeQuery, searchListings } from '../lib/search'
import { Icon } from './Icon'

const CODE_LIKE = /^[0-9A-Z]{4}[0-9]?$/

/**
 * Combobox for stock search (WAI-ARIA combobox pattern with a listbox popup).
 * Enter opens the highlighted suggestion, the first suggestion, or a typed code.
 */
export function SearchBox({
  variant = 'compact',
  label = '銘柄コードまたは社名で検索',
  placeholder,
  autoFocus = false,
  onSelect,
  excludeCodes = [],
  disabled = false,
  testId,
}: {
  variant?: 'hero' | 'compact'
  label?: string
  placeholder?: string
  autoFocus?: boolean
  onSelect?: (listing: Listing | { code: string; name: string }) => void
  excludeCodes?: string[]
  disabled?: boolean
  testId?: string
}) {
  const id = useId()
  const listId = `${id}-list`
  const navigate = useNavigate()
  const { sourceKind } = useApp()
  const example = sourceKind === 'demo' ? 'DM01、デモ精機' : '7203、トヨタ'
  const placeholderText =
    placeholder ??
    (variant === 'hero' ? `銘柄コードまたは社名（例: ${example}）` : '銘柄コード・社名で検索')
  const listings = useListings()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)

  const results = useMemo(() => {
    if (listings.data === undefined) return []
    return searchListings(listings.data.data, query, 8 + excludeCodes.length)
      .filter((l) => !excludeCodes.includes(l.code))
      .slice(0, 8)
  }, [listings.data, query, excludeCodes])

  const trimmed = query.trim()
  const showList = open && trimmed !== ''

  function choose(item: Listing | { code: string; name: string }) {
    setQuery('')
    setOpen(false)
    setActive(-1)
    if (onSelect !== undefined) {
      onSelect(item)
      inputRef.current?.focus()
    } else {
      inputRef.current?.blur()
      void navigate(`/stock/${encodeURIComponent(item.code)}`)
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        setOpen(true)
        if (results.length > 0) setActive((i) => (i + 1) % results.length)
        break
      case 'ArrowUp':
        event.preventDefault()
        setOpen(true)
        if (results.length > 0) setActive((i) => (i <= 0 ? results.length - 1 : i - 1))
        break
      case 'Enter': {
        if (trimmed === '') return
        event.preventDefault()
        const picked = results[active] ?? results[0]
        if (picked !== undefined) {
          choose(picked)
          return
        }
        const code = normalizeQuery(trimmed).toUpperCase()
        if (CODE_LIKE.test(code))
          choose({
            code: code.length === 5 && code.endsWith('0') ? code.slice(0, 4) : code,
            name: code,
          })
        break
      }
      case 'Escape':
        if (showList) {
          event.preventDefault()
          setOpen(false)
          setActive(-1)
        } else if (query !== '') {
          event.preventDefault()
          setQuery('')
        }
        break
      default:
        break
    }
  }

  let status: string | null = null
  if (showList) {
    if (listings.isPending) status = '銘柄一覧を読み込み中…'
    else if (listings.isError)
      status = '銘柄一覧を取得できませんでした。銘柄コードを入力して Enter で開けます。'
    else if (results.length === 0) status = `「${trimmed}」に一致する銘柄はありません`
  }
  const activeId =
    showList && active >= 0 && active < results.length ? `${listId}-${active}` : undefined

  return (
    <div className={variant === 'hero' ? 'search search--hero' : 'search'} data-testid={testId}>
      <label htmlFor={`${id}-input`} className="visually-hidden">
        {label}
      </label>
      <div className="search__field">
        <span className="search__icon">
          <Icon name="search" size={variant === 'hero' ? 22 : 18} />
        </span>
        <input
          ref={inputRef}
          id={`${id}-input`}
          type="search"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          autoFocus={autoFocus}
          disabled={disabled}
          placeholder={placeholderText}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
            setActive(-1)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            setOpen(false)
            setActive(-1)
          }}
          onKeyDown={onKeyDown}
        />
      </div>
      {showList && status !== null && (
        <div className="search__list search__status" role="status">
          {status}
        </div>
      )}
      <ul
        id={listId}
        role="listbox"
        aria-label="検索候補"
        className="search__list"
        hidden={!showList || results.length === 0}
      >
        {showList &&
          results.map((item, i) => (
            <li
              key={item.code}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className="search__option"
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(item)}
            >
              <span className="search__code">{item.code}</span>
              <span className="search__name">{item.name}</span>
              <span className="search__meta">{item.market}</span>
            </li>
          ))}
      </ul>
      <span className="visually-hidden" aria-live="polite">
        {showList && results.length > 0 ? `${results.length}件の候補があります` : ''}
      </span>
    </div>
  )
}
