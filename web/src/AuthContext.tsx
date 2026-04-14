import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { isLoggedIn as checkIsLoggedIn, getCurrentRole } from './auth'

type AuthContextType = {
  isAuthenticated: boolean
  role: string
  refreshAuth: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => checkIsLoggedIn())
  const [role, setRole] = useState(() => getCurrentRole())

  const refreshAuth = useCallback(() => {
    setIsAuthenticated(checkIsLoggedIn())
    setRole(getCurrentRole())
  }, [])

  return (
    <AuthContext.Provider value={{ isAuthenticated, role, refreshAuth }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
