'use client'

import { useState } from 'react'
import { 
  Bell, 
  Menu, 
  Search,
  User,
  LogOut
} from 'lucide-react'
import { ThemeToggle } from '@/components/dashboard/ThemeToggle'
import { useRouter } from 'next/navigation'

export function Header({ setSidebarOpen, user }) {
  const router = useRouter()
  const [showUserMenu, setShowUserMenu] = useState(false)

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
      router.push('/login')
    } catch (e) {
      console.error('Logout failed:', e)
    }
  }

  return (
    <header className="dashboard-header border-b border-slate-200/60 dark:border-white/[0.06]">
      <div className="flex items-center justify-between h-16 px-4 md:px-6">
        <div className="flex items-center">
          <button
            type="button"
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none dark:text-white/45 dark:hover:bg-white/[0.06] dark:hover:text-white lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="ml-4 lg:ml-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-400 dark:text-white/25">Operations</p>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Dashboard</h1>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="relative hidden md:block">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400 dark:text-white/25" />
            </div>
            <input
              type="text"
              placeholder="Search..."
              className="block w-full min-w-[240px] rounded-xl border border-slate-200/70 bg-white/90 py-2 pl-10 pr-3 text-sm leading-5 text-slate-700 shadow-[0_12px_30px_-24px_rgba(5,52,92,0.35)] outline-none transition placeholder:text-slate-400 focus:border-[#005cc0]/25 focus:shadow-[inset_0_-2px_0_rgba(0,92,192,0.9)] dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white dark:placeholder:text-white/25 dark:focus:border-violet-500/30 dark:focus:shadow-[inset_0_-2px_0_rgba(139,92,246,0.85)]"
            />
          </div>
          
          <ThemeToggle />
          
          <button className="rounded-full border border-slate-200/70 bg-white/80 p-2 text-slate-500 shadow-[0_12px_30px_-24px_rgba(5,52,92,0.4)] transition hover:text-slate-900 focus:outline-none dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white/45 dark:hover:bg-white/[0.08] dark:hover:text-white">
            <Bell className="h-6 w-6" />
          </button>
          
          <div className="relative">
            <button 
              className="flex items-center max-w-xs text-sm rounded-full focus:outline-none"
              onClick={() => setShowUserMenu(!showUserMenu)}
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#005cc0] to-[#3784f7] shadow-[0_14px_30px_-14px_rgba(55,132,247,0.8)]">
                <User className="h-5 w-5 text-white" />
              </div>
            </button>
            
            {showUserMenu && user && (
              <div className="absolute right-0 mt-2 w-56 rounded-lg border bg-white py-2 shadow-lg dark:bg-[#1a1d29] dark:border-white/[0.08]">
                <div className="px-4 py-2 border-b dark:border-white/[0.08]">
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{user.name || user.email}</p>
                  <p className="text-xs text-slate-500 dark:text-white/50">{user.email}</p>
                  <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">{user.role}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-white/70 dark:hover:bg-white/[0.06]"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
