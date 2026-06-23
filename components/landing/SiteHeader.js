'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { MessageSquare } from 'lucide-react'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'

export default function SiteHeader() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <header 
      className={`fixed top-0 inset-x-0 z-50 w-full transition-all duration-300 ${
        scrolled 
          ? 'bg-white/80 backdrop-blur-lg border-b border-slate-200/50 shadow-sm py-3' 
          : 'bg-transparent py-5'
      }`}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          
          <div className="flex items-center gap-2">
            <div className="bg-emerald-500 p-1.5 rounded-lg shadow-sm">
              <MessageSquare className="h-5 w-5 text-white" />
            </div>
            <Link href="/" className="flex items-center space-x-2">
              <span className="text-xl font-extrabold tracking-tight text-slate-900">Chatflow</span>
            </Link>
          </div>
          
          <nav className="hidden md:flex items-center gap-8">
            <Link href="#features" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Features</Link>
            <Link href="#automations" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Automations</Link>
            <Link href="#integrations" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Integrations</Link>
          </nav>
          
          <div className="flex items-center gap-4">
            <Link href="/login" className="hidden sm:block text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
              Sign in
            </Link>
            <Link href="/login">
              <Button className="bg-slate-900 text-white hover:bg-slate-800 rounded-full px-6 shadow-sm transition-all hover:scale-105">
                Start Free Trial
              </Button>
            </Link>
          </div>
          
        </div>
      </div>
    </header>
  )
}
