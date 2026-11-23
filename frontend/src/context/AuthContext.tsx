import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { User } from '../types'
import { api, getAuthToken, setAuthToken } from '../services/api'

interface AuthSessionPayload {
  user: User
  access_token: string
}

interface AuthContextType {
  user: User | null
  login: (email: string, password: string) => Promise<void>
  verifyLogin: (email: string, password: string) => Promise<AuthSessionPayload>
  commitLogin: (session: AuthSessionPayload) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const token = getAuthToken()
    if (!token) {
      try {
        localStorage.removeItem('neurolab_user')
      } catch {}
      return null
    }
    try {
      const stored = localStorage.getItem('neurolab_user')
      return stored ? (JSON.parse(stored) as User) : null
    } catch {
      return null
    }
  })

  useEffect(() => {
    const token = getAuthToken()
    if (token) {
      api
        .getMe()
        .then(freshUser => {
          setUser(freshUser)
          try {
            localStorage.setItem('neurolab_user', JSON.stringify(freshUser))
          } catch {}
        })
        .catch(() => {
          setAuthToken(null)
          try {
            localStorage.removeItem('neurolab_user')
          } catch {}
          setUser(null)
        })
    }

    const onUnauthorized = () => {
      setUser(null)
    }
    window.addEventListener('neurolab:unauthorized', onUnauthorized)
    return () => window.removeEventListener('neurolab:unauthorized', onUnauthorized)
  }, [])

  async function verifyLogin(email: string, password: string): Promise<AuthSessionPayload> {
    const res = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Error de autenticación' }))
      throw new Error(err.detail || 'Credenciales incorrectas')
    }
    const data = await res.json()
    return {
      user: data.user as User,
      access_token: data.access_token as string,
    }
  }

  function commitLogin(session: AuthSessionPayload) {
    setAuthToken(session.access_token)
    setUser(session.user)
    try {
      localStorage.setItem('neurolab_user', JSON.stringify(session.user))
    } catch {}
  }

  async function login(email: string, password: string) {
    const session = await verifyLogin(email, password)
    commitLogin(session)
  }

  function logout() {
    setUser(null)
    setAuthToken(null)
    try {
      localStorage.removeItem('neurolab_user')
    } catch {}
  }

  return (
    <AuthContext.Provider value={{ user, login, verifyLogin, commitLogin, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
