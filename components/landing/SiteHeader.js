'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { MessageSquare, ArrowRight } from 'lucide-react'
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
          ? 'bg-[#0a0d14]/80 backdrop-blur-lg border-b border-white/5 shadow-sm py-3' 
          : 'bg-transparent py-5'
      }`}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          
          <Link href="/" className="flex items-center gap-3">
            <div className="h-10 w-auto md:h-12 flex items-center justify-center">
              <img src="/chatflow-logo.png" alt="Chatflow" className="h-full w-full object-contain" />
            </div>
          </Link>
          
          <nav className="hidden md:flex items-center gap-8">
            <Link href="#features" className="text-sm font-medium text-slate-400 hover:text-white transition-colors">Tools</Link>
            <Link href="#automations" className="text-sm font-medium text-slate-400 hover:text-white transition-colors">Features</Link>
            <Link href="#how-it-works" className="text-sm font-medium text-slate-400 hover:text-white transition-colors">Workflow</Link>
          </nav>
          
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button className="bg-transparent text-slate-300 hover:text-white border border-white/10 hover:bg-white/5 rounded-full px-6 shadow-sm transition-all text-sm h-9">
                Launch Studio <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
          
        </div>
      </div>
    </header>
  )
}
