'use client'

import { useState, useEffect } from 'react'
import { useTheme } from 'next-themes'
import { motion, AnimatePresence } from 'motion/react'
import { Sun, Moon } from 'lucide-react'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Always default to light theme, but allow manual toggling
  useEffect(() => {
    if (mounted && theme !== 'light' && theme !== 'dark') {
      setTheme('light')
    }
  }, [mounted, theme, setTheme])

  if (!mounted) {
    return (
      <div className="w-10 h-10 flex items-center justify-center">
        <div className="h-5 w-5 animate-pulse rounded-full bg-slate-200 dark:bg-white/10"></div>
      </div>
    )
  }

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light')
  }

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={toggleTheme}
      className="rounded-full border border-slate-200/70 bg-white/80 p-2 text-slate-700 shadow-[0_12px_30px_-24px_rgba(5,52,92,0.4)] transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-[#3784f7] focus:ring-offset-2 focus:ring-offset-transparent dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white/70 dark:hover:bg-white/[0.08] dark:focus:ring-violet-500"
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      <AnimatePresence mode="wait">
        {theme === 'light' ? (
          <motion.div
            key="sun"
            initial={{ rotate: -90, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            exit={{ rotate: 90, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Sun className="w-5 h-5" />
          </motion.div>
        ) : (
          <motion.div
            key="moon"
            initial={{ rotate: 90, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            exit={{ rotate: -90, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Moon className="w-5 h-5" />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  )
}
