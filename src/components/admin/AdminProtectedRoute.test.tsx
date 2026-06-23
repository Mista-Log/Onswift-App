import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AdminProtectedRoute } from './AdminProtectedRoute'

const mockAdminAuth = vi.fn()
vi.mock('@/contexts/AdminAuthContext', () => ({
  useAdminAuth: () => mockAdminAuth(),
}))

const mockNavigateTo = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    Navigate: ({ to }: { to: string }) => {
      mockNavigateTo(to)
      return <div data-testid="redirect" data-to={to} />
    },
  }
})

function wrap(ui: React.ReactNode) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

describe('AdminProtectedRoute', () => {
  it('shows a spinner while auth is loading', () => {
    mockAdminAuth.mockReturnValue({ adminUser: null, isAdminLoading: true })
    wrap(<AdminProtectedRoute><div>secret</div></AdminProtectedRoute>)
    expect(screen.queryByText('secret')).toBeNull()
    expect(document.querySelector('.animate-spin')).toBeTruthy()
  })

  it('redirects to /admin/login when not authenticated', () => {
    mockAdminAuth.mockReturnValue({ adminUser: null, isAdminLoading: false })
    wrap(<AdminProtectedRoute><div>secret</div></AdminProtectedRoute>)
    expect(mockNavigateTo).toHaveBeenCalledWith('/admin/login')
    expect(screen.queryByText('secret')).toBeNull()
  })

  it('renders children when user is authenticated', () => {
    mockAdminAuth.mockReturnValue({
      adminUser: { id: 'u1', email: 'admin@onswift.com' },
      isAdminLoading: false,
    })
    wrap(<AdminProtectedRoute><div>secret</div></AdminProtectedRoute>)
    expect(screen.getByText('secret')).toBeInTheDocument()
  })
})
