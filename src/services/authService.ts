import { useAuthStore, setTokenClient, resolveTokenRequest, rejectTokenRequest } from '@/store/authStore'

const SCOPES = [
  'email',
  'profile',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.readonly',
].join(' ')

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string

declare global {
  interface Window {
    google: typeof google
    onGISLoaded: () => void
  }
}

function loadGISScript(): Promise<void> {
  return new Promise((resolve) => {
    if (document.getElementById('gis-script')) { resolve(); return }
    window.onGISLoaded = resolve
    const script = document.createElement('script')
    script.id = 'gis-script'
    script.src = 'https://accounts.google.com/gsi/client'
    script.onload = () => window.onGISLoaded()
    document.head.appendChild(script)
  })
}

let initialized = false

export async function initAuth(): Promise<void> {
  if (initialized) return
  await loadGISScript()

  const loginHint = useAuthStore.getState().user?.email
  const tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    login_hint: loginHint ?? undefined,
    callback: (resp) => {
      if (resp.error) {
        console.error('Token error:', resp.error)
        rejectTokenRequest(resp.error)
        return
      }
      resolveTokenRequest(resp.access_token, Number(resp.expires_in))
      void fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${resp.access_token}` },
      }).then(r => r.json()).then((info: { name?: string; email?: string; picture?: string }) => {
        if (info.email) {
          useAuthStore.getState().setUser({
            name: info.name ?? '',
            email: info.email,
            picture: info.picture ?? '',
          })
        }
      })
    },
  })

  setTokenClient(tokenClient)
  initialized = true
}
