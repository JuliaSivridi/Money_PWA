import { useAuthStore } from '@/store/authStore'

const DRIVE_BASE = 'https://www.googleapis.com/drive/v3'

async function driveRequest<T>(url: string): Promise<T> {
  const { accessToken, refreshToken } = useAuthStore.getState()
  const makeReq = async (token: string) =>
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })

  let res = await makeReq(accessToken ?? '')
  if (res.status === 401) {
    await refreshToken()
    res = await makeReq(useAuthStore.getState().accessToken ?? '')
  }
  if (!res.ok) throw new Error(`Drive API error ${res.status}`)
  return res.json() as Promise<T>
}

export async function listUserSheets(): Promise<{ id: string; name: string }[]> {
  const query = encodeURIComponent(
    `mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`,
  )
  const data = await driveRequest<{ files: { id: string; name: string }[] }>(
    `${DRIVE_BASE}/files?q=${query}&fields=files(id,name)&orderBy=modifiedTime+desc`,
  )
  return data.files ?? []
}
