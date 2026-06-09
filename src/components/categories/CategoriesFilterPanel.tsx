import { useUIStore } from '@/store/uiStore'

/** Format local Date as YYYY-MM-DD without timezone shift */
function localISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getMonthRange(offset: 0 | -1): { from: string; to: string } {
  const now = new Date()
  const month = now.getMonth() + offset
  return {
    from: localISO(new Date(now.getFullYear(), month, 1)),
    to:   localISO(new Date(now.getFullYear(), month + 1, 0)),
  }
}

function getYearRange(): { from: string; to: string } {
  const y = new Date().getFullYear()
  return { from: `${y}-01-01`, to: `${y}-12-31` }
}

function isoToDot(iso: string): string {
  if (!iso || iso.length < 10) return ''
  return `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`
}

function DatePicker({ value, onChange, placeholder = 'DD.MM.YYYY' }: {
  value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <div className="relative flex-1">
      <div className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background pointer-events-none min-h-[38px] flex items-center">
        {value ? <span>{isoToDot(value)}</span> : <span className="text-muted-foreground">{placeholder}</span>}
      </div>
      <input
        type="date"
        value={value}
        onChange={e => { if (e.target.value) onChange(e.target.value) }}
        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
      />
    </div>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors whitespace-nowrap ${
        active ? 'bg-primary/15 text-primary border-primary' : 'border-border text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
    </button>
  )
}

interface Props { open: boolean; onClose: () => void }

export function CategoriesFilterPanel({ open, onClose }: Props) {
  const { categoriesPeriod, setCategoriesPeriod } = useUIStore()

  const PRESETS = [
    { label: 'This month', range: getMonthRange(0) },
    { label: 'Last month', range: getMonthRange(-1) },
    { label: 'This year',  range: getYearRange() },
    { label: 'All time',   range: { from: '', to: '' } },
  ]

  const isActive = (range: { from: string; to: string }) =>
    categoriesPeriod.from === range.from && categoriesPeriod.to === range.to

  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />}
      <div
        className={`fixed inset-x-0 bottom-0 z-50 bg-background rounded-t-2xl border-t transition-transform duration-300 ease-out ${open ? 'translate-y-0' : 'translate-y-full'}`}
        style={{ maxHeight: '60dvh', display: 'flex', flexDirection: 'column' }}
      >
        <div className="flex justify-center pt-3 pb-2 shrink-0">
          <div className="w-10 h-1 rounded-full bg-muted" />
        </div>
        <div className="overflow-y-auto flex-1 px-4 pb-6 flex flex-col gap-5">
          <section>
            <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">Period</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {PRESETS.map(p => (
                <Chip key={p.label} active={isActive(p.range)} onClick={() => {
                  if (isActive(p.range)) setCategoriesPeriod({ from: '', to: '' })
                  else setCategoriesPeriod(p.range)
                }}>
                  {p.label}
                </Chip>
              ))}
            </div>
            <div className="flex gap-2 items-center">
              <DatePicker value={categoriesPeriod.from} onChange={v => setCategoriesPeriod({ ...categoriesPeriod, from: v })} />
              <span className="text-muted-foreground shrink-0">–</span>
              <DatePicker value={categoriesPeriod.to} onChange={v => setCategoriesPeriod({ ...categoriesPeriod, to: v })} />
            </div>
          </section>
          {(categoriesPeriod.from || categoriesPeriod.to) && (
            <button
              onClick={() => { setCategoriesPeriod({ from: '', to: '' }); onClose() }}
              className="self-start text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              Clear period
            </button>
          )}
        </div>
      </div>
    </>
  )
}
