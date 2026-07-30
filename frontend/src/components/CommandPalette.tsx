import * as Dialog from '@radix-ui/react-dialog'
import { Search, X, type LucideIcon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/cn'
import { LogoMark } from '@/components/Logo'

export interface CommandItem {
  id: string
  label: string
  description: string
  group: 'Navigate' | 'Actions'
  icon: LucideIcon
  keywords?: string
  onSelect: () => void
}

interface CommandPaletteProps {
  items: CommandItem[]
  isOffline: boolean
}

function isEditableTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && (
    target.isContentEditable
    || target.tagName === 'INPUT'
    || target.tagName === 'TEXTAREA'
    || target.tagName === 'SELECT'
  )
}

export function CommandPalette({ items, isOffline }: CommandPaletteProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const commandShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k'
      const slashShortcut = event.key === '/' && !isEditableTarget(event.target)
      if (!commandShortcut && !slashShortcut) return
      event.preventDefault()
      setOpen(current => !current)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (!open) return
    setQuery('')
    setActiveIndex(0)
  }, [open])

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return items
    return items.filter(item =>
      `${item.label} ${item.description} ${item.keywords || ''}`.toLowerCase().includes(normalized),
    )
  }, [items, query])

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  const selectItem = (item: CommandItem) => {
    setOpen(false)
    item.onSelect()
  }

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex(index => Math.min(index + 1, Math.max(filteredItems.length - 1, 0)))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex(index => Math.max(index - 1, 0))
    } else if (event.key === 'Enter' && filteredItems[activeIndex]) {
      event.preventDefault()
      selectItem(filteredItems[activeIndex])
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="group flex h-9 items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--bg-1)] px-2.5 text-[var(--fg-2)] transition-colors hover:border-[var(--accent)]/40 hover:text-[var(--fg-0)] sm:min-w-32"
          aria-label="Search and open commands"
        >
          <Search size={15} />
          <span className="hidden text-xs font-medium sm:inline">Search</span>
          <kbd className="ml-auto hidden rounded-md border border-[var(--line)] bg-[var(--bg-2)] px-1.5 py-0.5 font-mono text-[9px] text-[var(--fg-3)] sm:inline">
            Ctrl K
          </kbd>
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-slate-950/60 backdrop-blur-sm data-[state=closed]:animate-out data-[state=open]:animate-in" />
        <Dialog.Content
          className="fixed left-1/2 top-[12vh] z-[81] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-2xl border border-[var(--line-strong)] bg-[var(--bg-1)] shadow-[0_24px_80px_rgba(5,20,18,0.28)] outline-none"
          aria-describedby="command-palette-description"
        >
          <Dialog.Title className="sr-only">Search BroxStudies</Dialog.Title>
          <Dialog.Description id="command-palette-description" className="sr-only">
            Search pages and run common actions.
          </Dialog.Description>

          <div className="flex items-center gap-3 border-b border-[var(--line)] px-4">
            <LogoMark size={28} />
            <Search size={17} className="text-[var(--accent)]" />
            <input
              autoFocus
              value={query}
              onChange={event => setQuery(event.target.value)}
              onKeyDown={onInputKeyDown}
              placeholder="Where would you like to go?"
              className="h-14 min-w-0 flex-1 bg-transparent text-sm text-[var(--fg-0)] outline-none placeholder:text-[var(--fg-3)]"
              role="combobox"
              aria-controls="command-results"
              aria-expanded="true"
              aria-activedescendant={filteredItems[activeIndex] ? `command-${filteredItems[activeIndex].id}` : undefined}
            />
            <Dialog.Close
              className="grid h-8 w-8 place-items-center rounded-lg text-[var(--fg-3)] transition-colors hover:bg-[var(--bg-2)] hover:text-[var(--fg-0)]"
              aria-label="Close search"
            >
              <X size={16} />
            </Dialog.Close>
          </div>

          <div id="command-results" role="listbox" className="max-h-[min(58vh,440px)] overflow-y-auto p-2">
            {filteredItems.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <p className="text-sm font-semibold text-[var(--fg-1)]">No matching page or action</p>
                <p className="mt-1 text-xs text-[var(--fg-3)]">Try a subject, feature or action name.</p>
              </div>
            ) : (
              (['Navigate', 'Actions'] as const).map(group => {
                const groupItems = filteredItems.filter(item => item.group === group)
                if (!groupItems.length) return null
                return (
                  <div key={group} className="pb-2">
                    <div className="px-3 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--fg-3)]">
                      {group}
                    </div>
                    {groupItems.map(item => {
                      const itemIndex = filteredItems.indexOf(item)
                      const Icon = item.icon
                      const active = itemIndex === activeIndex
                      return (
                        <button
                          key={item.id}
                          id={`command-${item.id}`}
                          type="button"
                          role="option"
                          aria-selected={active}
                          onMouseEnter={() => setActiveIndex(itemIndex)}
                          onClick={() => selectItem(item)}
                          className={cn(
                            'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
                            active ? 'bg-[var(--accent-tint)] text-[var(--fg-0)]' : 'text-[var(--fg-1)] hover:bg-[var(--bg-2)]',
                          )}
                        >
                          <span className={cn(
                            'grid h-9 w-9 shrink-0 place-items-center rounded-lg border',
                            active
                              ? 'border-[var(--accent)]/25 bg-[var(--accent-tint)] text-[var(--accent)]'
                              : 'border-[var(--line)] bg-[var(--bg-2)] text-[var(--fg-2)]',
                          )}>
                            <Icon size={16} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold">{item.label}</span>
                            <span className="block truncate text-xs text-[var(--fg-3)]">{item.description}</span>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )
              })
            )}
          </div>

          <div className="flex items-center justify-between border-t border-[var(--line)] bg-[var(--bg-2)]/70 px-4 py-2 text-[10px] text-[var(--fg-3)]">
            <span>{isOffline ? 'Offline mode: cached pages remain available' : 'Online and ready'}</span>
            <span className="hidden gap-2 sm:flex"><kbd>↑↓</kbd> move <kbd>Enter</kbd> open <kbd>Esc</kbd> close</span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
