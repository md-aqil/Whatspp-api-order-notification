'use client'

import { motion } from 'framer-motion'
import { Shield, Zap, Lock } from 'lucide-react'

export default function TrustSection() {
  return (
    <section id="integrations" className="py-24 bg-[#0a0d14] border-t border-white/5 relative">
      <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.03] mix-blend-overlay pointer-events-none"></div>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-xs font-semibold tracking-widest text-slate-500 uppercase mb-8">
            Trusted by modern e-commerce brands & built on official APIs
          </h2>
          
          <div className="flex flex-wrap justify-center items-center gap-10 md:gap-20 opacity-30 hover:opacity-70 transition-all duration-700">
            {/* Minimalist text representations for logos to look cleaner */}
            <div className="text-2xl font-extrabold tracking-tighter text-white">Shopify</div>
            <div className="text-2xl font-extrabold tracking-tighter text-white">WhatsApp</div>
            <div className="text-2xl font-extrabold tracking-tighter text-white">Stripe</div>
            <div className="text-2xl font-extrabold tracking-tighter text-white">Zoho CRM</div>
            <div className="text-2xl font-extrabold tracking-tighter text-white">Meta</div>
          </div>
        </div>

        <div className="mt-32 grid grid-cols-1 md:grid-cols-3 gap-12 text-center max-w-5xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="p-6"
          >
            <div className="h-14 w-14 bg-white/5 border border-white/10 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-semibold text-slate-200 mb-3 tracking-tight">Secure & Encrypted</h3>
            <p className="text-sm text-slate-500 font-light leading-relaxed">End-to-end encryption for all WhatsApp communications. Your data never leaves our secure infrastructure.</p>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="p-6"
          >
            <div className="h-14 w-14 bg-[#5c8cff]/10 border border-[#5c8cff]/30 text-[#5c8cff] rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
              <Shield className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-semibold text-slate-200 mb-3 tracking-tight">Official Partner API</h3>
            <p className="text-sm text-slate-500 font-light leading-relaxed">Built directly on the official Meta WhatsApp Business API ensuring 100% compliance and deliverability.</p>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="p-6"
          >
            <div className="h-14 w-14 bg-white/5 border border-white/10 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
              <Zap className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-semibold text-slate-200 mb-3 tracking-tight">Enterprise Performance</h3>
            <p className="text-sm text-slate-500 font-light leading-relaxed">Engineered to handle thousands of messages and complex automations per minute with absolute zero lag.</p>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
