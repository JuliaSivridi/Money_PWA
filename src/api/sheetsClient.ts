import { useAuthStore } from '@/store/authStore'

const BASE = 'https://sheets.googleapis.com/v4/spreadsheets'

const rowCache = new Map<string, number>()

export function invalidateRowCache(): void {
  rowCache.clear()
}

async function getToken(): Promise<string> {
  const { accessToken, tokenExpiry, refreshToken } = useAuthStore.getState()
  if (!accessToken) throw new Error('Not authenticated')
  if (tokenExpiry && Date.now() > tokenExpiry - 60_000) {
    await refreshToken()
    const fresh = useAuthStore.getState().accessToken
    if (!fresh) throw new Error('Token refresh failed')
    return fresh
  }
  return accessToken
}

export async function sheetsRequest<T>(
  method: 'GET' | 'POST' | 'PUT',
  path: string,
  body?: unknown,
): Promise<T> {
  const token = await getToken()
  const spreadsheetId = useAuthStore.getState().spreadsheetId
  const url = `${BASE}/${spreadsheetId}/${path}`

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    if (res.status === 401) {
      try { await useAuthStore.getState().refreshToken() } catch {
        throw new Error('Session expired. Please sign in again.')
      }
      const freshToken = useAuthStore.getState().accessToken
      if (!freshToken) throw new Error('Session expired. Please sign in again.')
      const retry = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${freshToken}`, 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      })
      if (retry.ok) return retry.json() as Promise<T>
      const retryErr = await retry.json().catch(() => ({}))
      throw new Error(`Sheets API ${retry.status}: ${JSON.stringify(retryErr)}`)
    }
    const err = await res.json().catch(() => ({}))
    throw new Error(`Sheets API ${res.status}: ${JSON.stringify(err)}`)
  }

  return res.json() as Promise<T>
}

// Numeric sheet IDs (gid) cached per sheet title
const gidCache = new Map<string, number>()

async function getSheetGid(sheet: string): Promise<number> {
  if (gidCache.has(sheet)) return gidCache.get(sheet)!
  const token = await getToken()
  const spreadsheetId = useAuthStore.getState().spreadsheetId
  const res = await fetch(`${BASE}/${spreadsheetId}?fields=sheets.properties`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Sheets API ${res.status}: failed to read sheet metadata`)
  const meta = await res.json() as { sheets?: { properties: { title: string; sheetId: number } }[] }
  for (const s of meta.sheets ?? []) {
    gidCache.set(s.properties.title, s.properties.sheetId)
  }
  const gid = gidCache.get(sheet)
  if (gid == null) throw new Error(`Sheet "${sheet}" not found`)
  return gid
}

/** Physically deletes the row holding entityId. No-op if the row is not found. */
export async function deleteRowByEntityId(sheet: string, entityId: string): Promise<void> {
  const rowNum = await findRowIndex(sheet, entityId)
  if (!rowNum) return
  const gid = await getSheetGid(sheet)
  const token = await getToken()
  const spreadsheetId = useAuthStore.getState().spreadsheetId
  const res = await fetch(`${BASE}/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [{
        deleteDimension: {
          range: { sheetId: gid, dimension: 'ROWS', startIndex: rowNum - 1, endIndex: rowNum },
        },
      }],
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Sheets API ${res.status}: ${JSON.stringify(err)}`)
  }
  // Row numbers below the deleted row have shifted — cached indices are stale
  rowCache.clear()
}

export async function findRowIndex(sheet: string, entityId: string): Promise<number | null> {
  if (rowCache.has(entityId)) return rowCache.get(entityId)!

  const data = await sheetsRequest<{ values?: string[][] }>('GET', `values/${sheet}!A:A`)
  const rows = data.values ?? []
  for (let i = 1; i < rows.length; i++) {
    const id = rows[i][0]
    if (id) rowCache.set(id, i + 1)
  }

  return rowCache.get(entityId) ?? null
}
