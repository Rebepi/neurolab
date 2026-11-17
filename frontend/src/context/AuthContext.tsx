import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { User, UserRole } from '../types'

interface AuthContextType {
  user: User | null
  login: (email: string, password: string) => Promise<void>
  verifyLogin: (email: string, password: string) => Promise<User>
  commitLogin: (userData: User) => void
  logout: () => void
  switchDemoRole: (role: UserRole) => void
}

const DEMO_USERS: Record<UserRole, User> = {
  'Administrador': {
    id: 'usr-admin',
    email: 'admin@neurolab.io',
    display_name: 'Admin Principal',
    role: 'Administrador',
    status: 'ACTIVE'
  },
  'Responsable de proyecto': {
    id: 'usr-lead',
    email: 'lead@neurolab.io',
    display_name: 'Dra. Elena Ramos',
    role: 'Responsable de proyecto',
    status: 'ACTIVE'
  },
  'Ingeniero/analista de IA': {
    id: 'usr-engineer',
    email: 'engineer@neurolab.io',
    display_name: 'Ing. Carlos Mendoza',
    role: 'Ingeniero/analista de IA',
    status: 'ACTIVE'
  },
  'Revisor': {
    id: 'usr-reviewer',
    email: 'reviewer@neurolab.io',
    display_name: 'MSc. Sofía Castro',
    role: 'Revisor',
    status: 'ACTIVE'
  },
  'Lector': {
    id: 'usr-viewer',
    email: 'viewer@neurolab.io',
    display_name: 'Lucas Romero',
    role: 'Lector',
    status: 'ACTIVE'
  }
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem('neurolab_user')
    if (stored) {
      try {
        setUser(JSON.parse(stored))
      } catch {
        localStorage.removeItem('neurolab_user')
      }
    }
  }, [])

  async function verifyLogin(email: string, password: string): Promise<User> {
    const res = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Error de autenticación' }))
      throw new Error(err.detail || 'Credenciales incorrectas')
    }
    const data = await res.json()
    return data.user as User
  }

  function commitLogin(userData: User) {
    setUser(userData)
    localStorage.setItem('neurolab_user', JSON.stringify(userData))
  }

  async function login(email: string, password: string) {
    const userData = await verifyLogin(email, password)
    commitLogin(userData)
  }

  function switchDemoRole(role: UserRole) {
    const targetUser = DEMO_USERS[role]
    if (targetUser) {
      setUser(targetUser)
      localStorage.setItem('neurolab_user', JSON.stringify(targetUser))
    }
  }

  function logout() {
    setUser(null)
    localStorage.removeItem('neurolab_user')
  }

  return (
    <AuthContext.Provider value={{ user, login, verifyLogin, commitLogin, logout, switchDemoRole }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
