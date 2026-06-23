import { useState } from 'react'
import { Link } from 'react-router-dom'
import { LogOut, FileText, Folder, Menu, X } from 'lucide-react'
import { useAdminAuth } from '@/contexts/AdminAuthContext'
import { Button } from '@/components/ui/button'

interface AdminLayoutProps {
  children: React.ReactNode
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const { adminLogout } = useAdminAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleLogout = async () => {
    try { await adminLogout() } catch {}
  }

  const navLinks = (
    <>
      <div className="mb-3 text-xs font-semibold uppercase text-slate-500">
        Collection Types
      </div>
      <Link
        to="/admin/dashboard"
        onClick={() => setSidebarOpen(false)}
        className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
      >
        <FileText className="h-4 w-4" />
        Posts
      </Link>
      <Link
        to="/admin/categories"
        onClick={() => setSidebarOpen(false)}
        className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
      >
        <Folder className="h-4 w-4" />
        Categories
      </Link>
    </>
  )

  return (
    <div className="flex min-h-screen bg-slate-50">

      {/* ── Mobile backdrop ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 bg-white p-6
          transition-transform duration-200 ease-in-out
          lg:relative lg:w-56 lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Logo + close */}
        <div className="mb-8 flex items-center justify-between">
          <Link to="/" onClick={() => setSidebarOpen(false)}>
            <img src="/onswift-logo-white.png" alt="OnSwift" className="h-6 w-auto" />
          </Link>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden rounded-md p-1 text-slate-400 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1">{navLinks}</nav>

        {/* Logout */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleLogout}
          className="w-full justify-start gap-2"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </Button>
      </aside>

      {/* ── Main area ── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile header bar */}
        <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link to="/">
            <img src="/onswift-logo-white.png" alt="OnSwift" className="h-6 w-auto" />
          </Link>
        </div>

        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
