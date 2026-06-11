// Spreadsheet setup under the drive.file scope: the app can only see files
// it created itself or that the user picked via the Google Picker. There is
// deliberately NO silent find-by-name and NO silent create — on first run
// the user explicitly chooses "create new" or "pick existing" (AppShell).

import { useAuthStore } from '@/store/authStore'
import { SPREADSHEET_TITLE } from '@/utils/constants'

const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets'
const DRIVE_BASE = 'https://www.googleapis.com/drive/v3'

/**
 * 'ready' — the stored spreadsheet id is accessible.
 * 'setup' — no spreadsheet yet, or access was lost (scope migration) →
 *           AppShell shows the setup screen.
 */
export async function checkSpreadsheet(): Promise<'ready' | 'setup'> {
  const { spreadsheetId, setSpreadsheet, accessToken } = useAuthStore.getState()
  if (!spreadsheetId) return 'setup'
  if (!accessToken) throw new Error('Not authenticated')

  const res = await fetch(`${DRIVE_BASE}/files/${spreadsheetId}?fields=id,name`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (res.ok) {
    const f = await res.json() as { id: string; name: string }
    setSpreadsheet(f.id, f.name)   // keep the display name fresh
    return 'ready'
  }
  return 'setup'
}

/** Creates a fresh db_money spreadsheet (drive.file grants access to files the app creates). */
export async function createSpreadsheet(): Promise<void> {
  const { setSpreadsheet, accessToken } = useAuthStore.getState()
  if (!accessToken) throw new Error('Cannot create spreadsheet: not authenticated')

  const res = await fetch(SHEETS_BASE, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      properties: { title: SPREADSHEET_TITLE },
      sheets: [
        { properties: { title: 'transactions' } },
        { properties: { title: 'accounts' } },
        { properties: { title: 'categories' } },
        { properties: { title: 'settings' } },
      ],
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as Record<string, unknown>
    throw new Error(`Failed to create spreadsheet: ${JSON.stringify(err)}`)
  }

  const data = await res.json() as { spreadsheetId: string }
  setSpreadsheet(data.spreadsheetId, SPREADSHEET_TITLE)
}
