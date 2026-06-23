import { Navigate } from 'react-router-dom'
import { useAdminAuth } from '@/contexts/AdminAuthContext'

export function AdminProtectedRoute({ children }: { children: React.ReactNode }) {
  const { adminUser, isAdminLoading } = useAdminAuth()

  if (isAdminLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!adminUser) {
    return <Navigate to="/admin/login" replace />
  }

  return <>{children}</>
}
