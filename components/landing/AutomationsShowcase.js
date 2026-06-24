'use client'

import { motion } from 'framer-motion'
import { ArrowRight, ShoppingCart, Truck, RefreshCcw, MessageSquare, HelpCircle, Zap } from 'lucide-react'

const automations = [
  {
    title: "Order Confirmation Flow",
    trigger: "Shopify Order Created",
    action: "Send WhatsApp Receipt",
    icon: ShoppingCart,
    color: "text-[#5c8cff] bg-[#5c8cff]/10"
  },
  {
    title: "Abandoned Cart Rescue",
    trigger: "Cart Abandoned",
    action: "Send Reminder + Discount",
    icon: RefreshCcw,
    color: "text-[#5c8cff] bg-[#5c8cff]/10"
  },
  {
    title: "Shipping Updates",
    trigger: "Order Fulfilled",
    action: "Send Tracking URL",
    icon: Truck,
    color: "text-[#5c8cff] bg-[#5c8cff]/10"
  },
  {
    title: "Social Media Growth",
    trigger: "User comments on IG post",
    action: "Auto-send WhatsApp DM",
    icon: MessageSquare,
    color: "text-[#5c8cff] bg-[#5c8cff]/10"
  },
  {
    title: "FAQ Auto-Responder",
    trigger: "Customer asks a question",
    action: "AI matches KB & replies",
    icon: HelpCircle,
    color: "text-[#5c8cff] bg-[#5c8cff]/10"
  }
]

export default function AutomationsShowcase() {
  return (
    <section id="automations" className="py-32 bg-[#0a0d14] relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.03] mix-blend-overlay pointer-events-none"></div>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="flex flex-col lg:flex-row gap-20 items-center">
          
          <div className="lg:w-1/2">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-4xl font-bold tracking-tight text-white sm:text-5xl mb-6 leading-tight">
                Powerful Workflows, <br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-slate-300 to-slate-500">
                  Ready out of the box.
                </span>
              </h2>
              <p className="text-lg text-slate-400 font-light mb-10 leading-relaxed max-w-lg">
                Skip the complex setup. Chatflow comes pre-loaded with industry-standard automations designed to convert and retain customers from day one. Just connect your store and toggle them on.
              </p>
            </motion.div>
            
            <div className="space-y-4">
              {automations.map((auto, idx) => (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1, duration: 0.5 }}
                  className="group bg-white/5 backdrop-blur-md p-5 rounded-2xl border border-white/10 hover:border-[#5c8cff]/40 transition-all duration-300 flex items-center justify-between cursor-default hover:bg-white/10"
                >
                  <div className="flex items-center gap-5">
                    <div className={`p-3 rounded-xl ${auto.color} group-hover:scale-110 transition-transform duration-300`}>
                      <auto.icon className={`h-6 w-6`} />
                    </div>
                    <div>
                      <div className="font-medium text-slate-200 tracking-tight">{auto.title}</div>
                      <div className="text-sm text-slate-500 flex items-center gap-1.5 mt-0.5 font-light">
                        <span className="font-medium text-slate-400">Trigger:</span> {auto.trigger}
                      </div>
                    </div>
                  </div>
                  <div className="hidden sm:flex items-center gap-3">
                    <ArrowRight className="h-4 w-4 text-slate-500 group-hover:text-[#5c8cff] transition-colors duration-300" />
                    <div className="text-xs font-medium text-slate-300 bg-white/5 px-4 py-1.5 rounded-full border border-white/10 shadow-sm">
                      {auto.action}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="lg:w-1/2 w-full mt-12 lg:mt-0">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="relative rounded-3xl bg-[#0b1016] shadow-[0_0_80px_rgba(9,34,118,0.2)] p-8 overflow-hidden border border-white/10"
            >
              {/* Glassmorphism gradient effect inside the card */}
              <div className="absolute -top-32 -right-32 w-64 h-64 bg-[#092276] rounded-full mix-blend-screen filter blur-[80px] opacity-40"></div>
              
              <div className="flex items-center justify-between mb-10 border-b border-white/5 pb-5">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-[#5c8cff] animate-pulse"></div>
                  <div className="text-slate-300 font-medium tracking-wide text-sm uppercase">Active Automations</div>
                </div>
                <div className="flex gap-2">
                  <div className="h-3 w-3 rounded-full bg-white/10 hover:bg-red-400 transition-colors"></div>
                  <div className="h-3 w-3 rounded-full bg-white/10 hover:bg-yellow-400 transition-colors"></div>
                  <div className="h-3 w-3 rounded-full bg-white/10 hover:bg-[#5c8cff] transition-colors"></div>
                </div>
              </div>
              
              <div className="space-y-6 relative z-10">
                {[
                  { name: 'Cart Recovery', active: true, sent: '2.4k' },
                  { name: 'Order Confirmation', active: true, sent: '8.1k' },
                  { name: 'Shipping Updates', active: true, sent: '7.9k' },
                  { name: 'Review Request', active: false, sent: '0' }
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between group">
                    <div className="flex items-center gap-5">
                      <div className={`h-12 w-12 rounded-xl flex items-center justify-center border ${item.active ? 'bg-[#5c8cff]/10 border-[#5c8cff]/30 text-[#5c8cff]' : 'bg-white/5 border-white/10 text-slate-600'}`}>
                        <Zap className="h-5 w-5" />
                      </div>
                      <div>
                        <div className={`font-medium mb-1 tracking-tight ${item.active ? 'text-slate-200' : 'text-slate-500'}`}>{item.name}</div>
                        <div className="text-xs text-slate-500 font-mono">{item.active ? 'Running smoothly' : 'Paused'}</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6">
                      <div className="hidden sm:block text-slate-500 text-sm font-mono text-right">
                        {item.sent} <span className="text-slate-600 text-xs">sent</span>
                      </div>
                      <div className={`h-6 w-11 rounded-full relative flex items-center px-1 transition-colors duration-300 ${item.active ? 'bg-[#5c8cff]' : 'bg-white/10'}`}>
                        <motion.div 
                          initial={false}
                          animate={{ x: item.active ? 20 : 0 }}
                          className={`h-4 w-4 rounded-full shadow-sm ${item.active ? 'bg-white' : 'bg-slate-500'}`}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-10 pt-6 border-t border-white/5 relative z-10">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400 font-light">Messages automated today</span>
                  <span className="text-[#5c8cff] font-mono bg-[#5c8cff]/10 border border-[#5c8cff]/20 px-3 py-1 rounded-full">1,284</span>
                </div>
              </div>
            </motion.div>
          </div>

        </div>
      </div>
    </section>
  )
}
