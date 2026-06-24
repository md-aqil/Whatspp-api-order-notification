'use client'

import { motion } from 'framer-motion'
import { ShoppingCart, Bell, Users, BookOpen, Package, Zap } from 'lucide-react'

const features = [
  {
    name: 'Smart Abandoned Cart Recovery',
    description: 'Track abandoned checkouts instantly. Automatically send personalized WhatsApp reminders with checkout links and dynamic discount codes.',
    icon: ShoppingCart,
  },
  {
    name: 'Real-Time Order Alerts',
    description: 'Keep customers updated effortlessly with Order Confirmations, Shipping Tracking, and Delivery notifications sent directly to their phones.',
    icon: Bell,
  },
  {
    name: 'Shared Team Inbox',
    description: 'Invite your entire team to manage all customer WhatsApp chats in one unified dashboard. Collaborate, assign, and never miss a message.',
    icon: Users,
  },
  {
    name: 'AI Knowledge Base',
    description: 'Upload your documents and FAQs. Let our AI instantly answer common customer queries via WhatsApp 24/7, reducing support tickets.',
    icon: BookOpen,
  },
  {
    name: 'Product Catalog Integration',
    description: 'Sync your Shopify products seamlessly. Share them directly within WhatsApp conversations, allowing customers to browse and buy easily.',
    icon: Package,
  },
  {
    name: 'Seamless Integrations',
    description: 'Connect natively with Shopify, WhatsApp Business API, Zoho CRM, Stripe, and Google Sheets in just a few clicks. No coding required.',
    icon: Zap,
  },
]

export default function FeaturesGrid() {
  return (
    <section id="features" className="py-32 bg-[#0a0d14] relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
      
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-sm font-semibold tracking-widest text-[#5c8cff] uppercase mb-3">
              Platform Features
            </h2>
            <h3 className="text-4xl font-bold tracking-tight text-white sm:text-5xl mb-6">
              Everything you need to <br/> scale your brand
            </h3>
            <p className="text-lg text-slate-400 font-light leading-relaxed">
              A complete, unified suite of tools meticulously designed to automate your e-commerce communications, support your customers, and significantly boost your bottom line.
            </p>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <motion.div 
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="group relative p-8 bg-white/5 backdrop-blur-sm rounded-3xl border border-white/10 hover:border-[#5c8cff]/40 transition-all duration-500 hover:bg-white/10"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-[#092276]/0 to-[#092276]/0 group-hover:from-[#092276]/10 group-hover:to-transparent rounded-3xl transition-all duration-500 pointer-events-none"></div>
              
              <div className="relative z-10">
                <span className="inline-flex items-center justify-center w-14 h-14 bg-black/40 group-hover:bg-[#092276]/40 rounded-2xl mb-6 transition-colors duration-500 border border-white/10 group-hover:border-[#5c8cff]/30 shadow-sm">
                  <feature.icon className="h-6 w-6 text-slate-300 group-hover:text-white transition-colors duration-500" aria-hidden="true" />
                </span>
                <h4 className="text-xl font-semibold text-white mb-3 tracking-tight">
                  {feature.name}
                </h4>
                <p className="text-slate-400 leading-relaxed font-light text-sm">
                  {feature.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
