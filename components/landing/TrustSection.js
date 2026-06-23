'use client'

import { motion } from 'framer-motion'
import { Shield, Zap, Lock } from 'lucide-react'

export default function TrustSection() {
  return (
    <section id="integrations" className="py-24 bg-white border-t border-slate-100">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-sm font-semibold tracking-widest text-slate-400 uppercase mb-8">
            Trusted by modern e-commerce brands & built on official APIs
          </h2>
          
          <div className="flex flex-wrap justify-center items-center gap-10 md:gap-20 opacity-50 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-700">
            {/* Minimalist text representations for logos to look cleaner */}
            <div className="text-2xl font-extrabold tracking-tighter text-slate-800">Shopify</div>
            <div className="text-2xl font-extrabold tracking-tighter text-emerald-600">WhatsApp</div>
            <div className="text-2xl font-extrabold tracking-tighter text-indigo-600">Stripe</div>
            <div className="text-2xl font-extrabold tracking-tighter text-blue-600">Zoho CRM</div>
            <div className="text-2xl font-extrabold tracking-tighter text-blue-800">Meta</div>
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
            <div className="h-14 w-14 bg-slate-50 border border-slate-100 text-slate-700 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-3 tracking-tight">Secure & Encrypted</h3>
            <p className="text-sm text-slate-500 font-light leading-relaxed">End-to-end encryption for all WhatsApp communications. Your data never leaves our secure infrastructure.</p>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="p-6"
          >
            <div className="h-14 w-14 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
              <Shield className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-3 tracking-tight">Official Partner API</h3>
            <p className="text-sm text-slate-500 font-light leading-relaxed">Built directly on the official Meta WhatsApp Business API ensuring 100% compliance and deliverability.</p>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="p-6"
          >
            <div className="h-14 w-14 bg-slate-50 border border-slate-100 text-slate-700 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
              <Zap className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-3 tracking-tight">Enterprise Performance</h3>
            <p className="text-sm text-slate-500 font-light leading-relaxed">Engineered to handle thousands of messages and complex automations per minute with absolute zero lag.</p>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
