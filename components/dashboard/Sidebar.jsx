'use client'

import { useState } from 'react'
import { 
  MessageCircle, 
  Store, 
  CreditCard, 
  Settings,
  Menu,
  X,
  Send,
  Megaphone
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function Sidebar({ sidebarOpen, setSidebarOpen }) {
  const pathname = usePathname()
  
  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: Store },
    { name: 'Chat', href: '/dashboard/chat', icon: MessageCircle },
    { name: 'Campaigns', href: '/dashboard/campaigns', icon: Megaphone },
    { name: 'Send Catalog', href: '/dashboard/send-catalog', icon: Send },
    { name: 'Orders', href: '/dashboard/orders', icon: CreditCard },
    { name: 'Settings', href: '/dashboard/settings', icon: Settings },
  ]

  return (
    <>
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      {/* Sidebar */}
      <div 
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } flex flex-col`}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b">
          <div className="flex items-center">
            <div className="bg-blue-500 text-white p-2 rounded-lg">
              <MessageCircle className="h-6 w-6" />
            </div>
            <span className="ml-2 font-semibold">WhatsApp Commerce</span>
          </div>
          <button 
            className="lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        
        <nav className="flex-1 overflow-y-auto mt-5 px-2">
          <div className="space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <Icon className="h-5 w-5 mr-3" />
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