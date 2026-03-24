'use client'

import { useState } from 'react'
import { 
  MessageCircle, 
  Store, 
  CreditCard, 
  Settings,
  X,
  Send,
  Megaphone,
  Workflow
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function Sidebar({ sidebarOpen, setSidebarOpen }) {
  const pathname = usePathname()
  
  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: Store },
    { name: 'Chat', href: '/dashboard/chat', icon: MessageCircle },
    { name: 'Campaigns', href: '/dashboard/campaigns', icon: Megaphone },
    { name: 'Automations', href: '/dashboard/automations', icon: Workflow },
    { name: 'Send Catalog', href: '/dashboard/send-catalog', icon: Send },
    { name: 'Orders', href: '/dashboard/orders', icon: CreditCard },
    { name: 'Settings', href: '/dashboard/settings', icon: Settings },
  ]

  return (
    <>
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      {/* Sidebar */}
      <div 
        className={`fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } dashboard-sidebar flex flex-col`}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-slate-200/60 dark:border-white/[0.06]">
          <div className="flex items-center">
            <div className="rounded-xl bg-gradient-to-br from-[#005cc0] to-[#3784f7] p-2 text-white shadow-[0_12px_32px_-14px_rgba(55,132,247,0.85)]">
              <MessageCircle className="h-6 w-6" />
            </div>
            <div className="ml-3">
              <span className="block text-sm font-semibold text-slate-900 dark:text-white">WhatsApp Commerce</span>
              <span className="block text-[11px] uppercase tracking-[0.24em] text-slate-500 dark:text-white/35">Control Room</span>
            </div>
          </div>
          <button 
            className="rounded-lg p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-white/45 dark:hover:bg-white/[0.06] dark:hover:text-white lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        
        <nav className="flex-1 overflow-y-auto px-3 py-5">
          <div className="mb-4 px-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400 dark:text-white/25">Workspace</p>
          </div>
          <div className="space-y-1.5">
            {navigation.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`group flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all ${
                    isActive
                      ? 'bg-[#dce9ff] text-[#05345c] shadow-[0_20px_40px_-28px_rgba(5,52,92,0.45)] dark:bg-violet-600/15 dark:text-white dark:ring-1 dark:ring-violet-500/30'
                      : 'text-slate-600 hover:bg-slate-100/90 hover:text-slate-900 dark:text-white/55 dark:hover:bg-white/[0.05] dark:hover:text-white'
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <span className={`flex h-9 w-9 items-center justify-center rounded-lg transition-all ${
                    isActive
                      ? 'bg-white/80 text-[#005cc0] dark:bg-violet-500/15 dark:text-violet-300'
                      : 'bg-slate-100 text-slate-500 group-hover:bg-white group-hover:text-[#005cc0] dark:bg-white/[0.04] dark:text-white/35 dark:group-hover:bg-white/[0.08] dark:group-hover:text-violet-300'
                  }`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  {item.name}
                </Link>
              )
            })}
          </div>
        </nav>
      </div>
    </>
  )
}
