import { useState } from 'react'
import { CreditCard, Wallet, PiggyBank, TrendingUp, ChevronDown, ChevronRight } from 'lucide-react'
import { AccountModal } from './AccountModal'
import { AccountsFilterPanel } from './AccountsFilterPanel'
import { useAccountsStore } from '@/store/accountsStore'
import { useTransactionsStore } from '@/store/transactionsStore'
import { useUIStore } from '@/store/uiStore'
import { formatAmount } from '@/utils/currencyUtils'
import { DEFAULT_ENTITY_COLOR, ON_COLOR_TEXT, ICON_SIZES } from '@/utils/design'
import { FAB } from '@/components/common/FAB'
import type { Account, AccountType } from '@/types/account'

const TYPE_CONFIG: Record<AccountType, { label: string; Icon: React.FC<{ size?: number }> }> = {
  card:       { label: 'Cards & Accounts', Icon: CreditCard },
  cash:       { label: 'Cash',             Icon: Wallet },
  savings:    { label: 'Savings',          Icon: PiggyBank },
  investment: { label: 'Investments',      Icon: TrendingUp },
}

function AccountRow({ account, onClick }: { account: Account; onClick: () => void }) {
  const { Icon } = TYPE_CONFIG[account.type]
  const color = account.color || DEFAULT_ENTITY_COLOR
  return (
    <button onClick={onClick} className="flex items-center gap-3 w-full px-4 py-3 hover:bg-accent transition-colors text-left">
      <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: color, color: ON_COLOR_TEXT }}>
        <Icon size={ICON_SIZES.lg} />
      </div>
      <div className="flex-1">
        <p className="font-medium">{account.name}</p>
        <p className="text-sm text-muted-foreground">{account.currency}</p>
      </div>
      <span className={`font-medium ${account.balance < 0 ? 'text-red-400' : ''}`}>
        {formatAmount(account.balance, account.currency)}
      </span>
    </button>
  )
}

function Section({ title, accounts, Icon, onEdit }: { title: string; accounts: Account[]; Icon: React.FC<{ size?: number }>; onEdit: (a: Account) => void }) {
  const [open, setOpen] = useState(true)
  if (accounts.length === 0) return null
  return (
    <div className="mb-2">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 w-full px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <Icon size={16} />
        <span>{title}</span>
        <span className="ml-auto">{accounts.length}</span>
      </button>
      {open && accounts.map(a => <AccountRow key={a.id} account={a} onClick={() => onEdit(a)} />)}
    </div>
  )
}

export function AccountsPage() {
  const { accounts } = useAccountsStore()
  const { transactions } = useTransactionsStore()
  const { accountsSearch, accountsFilter, accountsFilterOpen, setAccountsFilterOpen } = useUIStore()
  const [createOpen, setCreateOpen] = useState(false)
  const [editAccount, setEditAccount] = useState<Account | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  const q = accountsSearch.trim().toLowerCase()
  const allActive = accounts.filter(a => !a.archived)
  const active = allActive.filter(a => {
    if (q && !a.name.toLowerCase().includes(q)) return false
    if (accountsFilter.types.length > 0 && !accountsFilter.types.includes(a.type)) return false
    if (accountsFilter.currencies.length > 0 && !accountsFilter.currencies.includes(a.currency)) return false
    return true
  })
  const archived = accounts.filter(a => a.archived)

  // Debt section: open debt transactions grouped by counterpart
  const openDebts = transactions.filter(t =>
    (t.type === 'debt_lent' || t.type === 'debt_borrowed') && !t.debt_ref_id
  )
  const closedDebtRefs = new Set(
    transactions.filter(t => t.debt_ref_id).map(t => t.debt_ref_id)
  )
  const trueOpenDebts = openDebts.filter(t => !closedDebtRefs.has(t.id))

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        {accounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
            <CreditCard size={40} className="opacity-20" />
            <p>No accounts yet</p>
          </div>
        ) : (
          <>
            {(['cash', 'card', 'savings', 'investment'] as AccountType[]).map(type => (
              <Section
                key={type}
                title={TYPE_CONFIG[type].label}
                Icon={TYPE_CONFIG[type].Icon}
                accounts={active.filter(a => a.type === type)}
                onEdit={setEditAccount}
              />
            ))}

            {/* Debts section */}
            {trueOpenDebts.length > 0 && (
              <div className="mb-2">
                <div className="px-4 py-2 text-sm font-medium text-muted-foreground">Debts</div>
                {trueOpenDebts.map(t => (
                  <div key={t.id} className="flex items-center gap-3 px-4 py-3 border-b last:border-0">
                    <div className="flex-1">
                      <p>{t.comment || 'Unknown'}</p>
                      <p className="text-sm text-muted-foreground">{t.type === 'debt_lent' ? 'You lent' : 'You borrowed'}</p>
                    </div>
                    <span className={t.type === 'debt_lent' ? 'text-red-400' : 'text-green-400'}>
                      {formatAmount(t.amount, t.currency)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Archived */}
            {archived.length > 0 && (
              <div className="px-4 py-3">
                <button onClick={() => setShowArchived(!showArchived)} className="text-sm text-muted-foreground hover:text-foreground">
                  {showArchived ? 'Hide' : 'Show'} archived ({archived.length})
                </button>
                {showArchived && archived.map(a => <AccountRow key={a.id} account={a} onClick={() => setEditAccount(a)} />)}
              </div>
            )}
          </>
        )}
      </div>

      <FAB onClick={() => setCreateOpen(true)} />

      <AccountsFilterPanel open={accountsFilterOpen} onClose={() => setAccountsFilterOpen(false)} />

      <AccountModal
        open={createOpen || editAccount !== null}
        editing={editAccount}
        onClose={() => { setCreateOpen(false); setEditAccount(null) }}
      />
    </div>
  )
}
