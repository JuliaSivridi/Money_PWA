import { useAuthStore } from '@/store/authStore'
import { SPREADSHEET_TITLE } from '@/utils/constants'

const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets'
const DRIVE_BASE = 'https://www.googleapis.com/drive/v3'

export async function ensureSpreadsheet(): Promise<{ isNew: boolean }> {
  const { spreadsheetId, setSpreadsheet, accessToken } = useAuthStore.getState()
  if (spreadsheetId) return { isNew: false }
  if (!accessToken) throw new Error('Cannot find/create spreadsheet: not authenticated')

  const query = encodeURIComponent(
    `name='${SPREADSHEET_TITLE}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`,
  )
  const listRes = await fetch(`${DRIVE_BASE}/files?q=${query}&fields=files(id,name)`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!listRes.ok) {
    const err = await listRes.json().catch(() => ({})) as Record<string, unknown>
    throw new Error(`Failed to search Drive: ${JSON.stringify(err)}`)
  }

  const list = await listRes.json() as { files: { id: string; name: string }[] }
  if (list.files.length > 0) {
    setSpreadsheet(list.files[0].id, list.files[0].name)
    return { isNew: false }
  }

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
  return { isNew: true }
}
