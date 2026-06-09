import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface User {
  name: string
  email: string
  picture: string
}

interface AuthState {
  user: User | null
  accessToken: string | null
  tokenExpiry: number | null
  isAuthenticated: boolean
  spreadsheetId: string
  spreadsheetName: string
  setToken: (token: string, expiresIn: number) => void
  setUser: (user: User) => void
  setSpreadsheet: (id: string, name: string) => void
  refreshToken: () => Promise<void>
  logout: () => void
}

let _tokenClient: google.accounts.oauth2.TokenClient | null = null
let _pendingResolve: (() => void) | null = null
let _pendingReject: ((err: Error) => void) | null = null

export function setTokenClient(client: google.accounts.oauth2.TokenClient): void {
  _tokenClient = client
}

export function resolveTokenRequest(token: string, expiresIn: number): void {
  useAuthStore.getState().setToken(token, expiresIn)
  _pendingResolve?.()
  _pendingResolve = null
  _pendingReject = null
}

export function rejectTokenRequest(error: string): void {
  _pendingReject?.(new Error(error))
  _pendingResolve = null
  _pendingReject = null
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      tokenExpiry: null,
      isAuthenticated: false,
      spreadsheetId: '',
      spreadsheetName: '',

      setToken: (token, expiresIn) => {
        set({
          accessToken: token,
          tokenExpiry: Date.now() + expiresIn * 1000,
          isAuthenticated: true,
        })
      },

      setUser: (user) => set({ user }),

      setSpreadsheet: (id, name) => set({ spreadsheetId: id, spreadsheetName: name }),

      refreshToken: () =>
        new Promise<void>((resolve, reject) => {
          if (!_tokenClient) { reject(new Error('Token client not initialized')); return }
          _pendingResolve = resolve
          _pendingReject = reject
          _tokenClient.requestAccessToken({ prompt: '' })
        }),

      logout: () => {
        const token = get().accessToken
        if (token && window.google?.accounts?.oauth2) {
          window.google.accounts.oauth2.revoke(token, () => {})
        }
        set({
          user: null, accessToken: null, tokenExpiry: null,
          isAuthenticated: false, spreadsheetId: '', spreadsheetName: '',
        })
      },
    }),
    {
      name: 'money-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        tokenExpiry: state.tokenExpiry,
        spreadsheetId: state.spreadsheetId,
        spreadsheetName: state.spreadsheetName,
      }),
    },
  ),
)
