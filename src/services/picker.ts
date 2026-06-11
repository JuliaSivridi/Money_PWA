// Google Picker — the native Drive file-open dialog.
// With the drive.file scope, a file selected here is permanently granted to
// the app (the grant lives on Google's side, not on this device).

import { useAuthStore } from '@/store/authStore'

const GAPI_SRC = 'https://apis.google.com/js/api.js'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string
export const PICKER_API_KEY = (import.meta.env.VITE_GOOGLE_API_KEY as string | undefined) ?? ''
// Cloud project number — the numeric prefix of the OAuth client id
export const PICKER_APP_ID = CLIENT_ID.split('-')[0] ?? ''

let pickerReady: Promise<void> | null = null

/* eslint-disable @typescript-eslint/no-explicit-any */
function w(): any { return window as any }

function loadPickerApi(): Promise<void> {
  if (pickerReady) return pickerReady
  pickerReady = new Promise<void>((resolve, reject) => {
    const onGapi = () => w().gapi.load('picker', { callback: () => resolve() })
    if (w().gapi?.load) { onGapi(); return }
    const s = document.createElement('script')
    s.src = GAPI_SRC
    s.async = true
    s.onload = onGapi
    s.onerror = () => reject(new Error('Failed to load Google API script'))
    document.head.appendChild(s)
  })
  return pickerReady
}

async function getToken(): Promise<string> {
  const { accessToken, tokenExpiry, refreshToken } = useAuthStore.getState()
  if (accessToken && (!tokenExpiry || Date.now() < tokenExpiry - 60_000)) return accessToken
  await refreshToken()
  const fresh = useAuthStore.getState().accessToken
  if (!fresh) throw new Error('Not authorized')
  return fresh
}

export interface PickedFile { id: string; name: string }

/** Opens the Google Picker limited to spreadsheets.
 *  Resolves with the picked file, or null if the user cancelled. */
export async function openSpreadsheetPicker(): Promise<PickedFile | null> {
  const token = await getToken()
  await loadPickerApi()

  const picker = w().google.picker
  return new Promise<PickedFile | null>((resolve) => {
    const view = new picker.DocsView(picker.ViewId.SPREADSHEETS)
      .setIncludeFolders(true)
      .setSelectFolderEnabled(false)

    const dialog = new picker.PickerBuilder()
      .setAppId(PICKER_APP_ID)
      .setOAuthToken(token)
      .setDeveloperKey(PICKER_API_KEY)
      .addView(view)
      .setCallback((data: { action: string; docs?: { id: string; name: string }[] }) => {
        if (data.action === picker.Action.PICKED && data.docs?.[0]) {
          resolve({ id: data.docs[0].id, name: data.docs[0].name })
        } else if (data.action === picker.Action.CANCEL) {
          resolve(null)
        }
      })
      .build()
    dialog.setVisible(true)
  })
}
