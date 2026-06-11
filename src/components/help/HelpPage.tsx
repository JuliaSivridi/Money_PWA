const sections: { title: string; items: [string, string][] }[] = [
  {
    title: 'Basics',
    items: [
      ['Transactions', 'The home view. Tap + to add an expense, income, transfer between accounts, or a debt record. Tap a transaction to edit it.'],
      ['Accounts', 'Your wallets, cards and bank accounts with current balances. Balances update automatically with every transaction.'],
      ['Categories', 'Expense and income categories with optional monthly limits. Drag to reorder; tap to edit.'],
      ['Analytics', 'Yearly and monthly charts: income vs expenses, balance line, per-category breakdown. Tap a month for details.'],
    ],
  },
  {
    title: 'Data & sync',
    items: [
      ['Where is my data?', 'Everything lives in a Google Sheets file (db_money) in your own Google Drive. You can open and inspect it any time.'],
      ['Cloud icon', 'Shows sync status: a number badge means changes waiting to be sent; a spinning arrow means syncing. Tap it to sync now.'],
      ['Offline', 'The app works offline — changes are queued locally and sent to Google Sheets when you are back online.'],
      ['Multiple devices', 'You can use the app on several devices with the same Google account; the most recent edit wins.'],
    ],
  },
  {
    title: 'Tips',
    items: [
      ['Currencies', 'Each account has its own currency. Totals are converted to your base currency using daily exchange rates.'],
      ['Search & filters', 'On Transactions, search by comment or open the filter panel: accounts, types, categories, dates, amounts.'],
      ['Limits', 'Set a monthly limit on a category to track it in Categories and Analytics.'],
    ],
  },
]

export function HelpPage() {
  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-lg mx-auto flex flex-col gap-6">
          {sections.map(s => (
            <section key={s.title}>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">{s.title}</h2>
              <div className="rounded-xl border border-border divide-y divide-border">
                {s.items.map(([term, text]) => (
                  <div key={term} className="px-3 py-2.5">
                    <p className="text-sm font-medium">{term}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">{text}</p>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
