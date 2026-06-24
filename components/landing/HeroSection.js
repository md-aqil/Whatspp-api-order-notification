'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ArrowRight, MessageCircle, Sparkles, CheckCircle2 } from 'lucide-react'
import { useState, useEffect } from 'react'

const CHAT_SEQUENCE = [
  { id: 1, type: 'system', text: 'Cart Abandoned: $124.99 (Nike Air Max)', delay: 500 },
  { id: 2, type: 'bot', text: 'Hi Alex! 👋 We noticed you left something in your cart.', delay: 1500 },
  { id: 3, type: 'bot', text: 'Complete your order now and get 10% OFF using code: SAVE10 🎁', delay: 2500, link: 'Complete Checkout' },
  { id: 4, type: 'user', text: 'Does the discount apply to shipping too?', delay: 4500 },
  { id: 5, type: 'bot', text: 'Yes! The SAVE10 code gives you 10% off your entire order, including shipping. Need help checking out?', delay: 6000 },
  { id: 6, type: 'system', text: 'Order Placed: $112.49 🚀', delay: 8500 },
]

export default function HeroSection() {
  const [messages, setMessages] = useState([])
  const [isTyping, setIsTyping] = useState(false)

  useEffect(() => {
    let timeouts = []
    
    const runSequence = () => {
      setMessages([])
      
      CHAT_SEQUENCE.forEach((msg, index) => {
        // Show typing indicator before bot messages
        if (msg.type === 'bot' || msg.type === 'user') {
          timeouts.push(
            setTimeout(() => {
              setIsTyping(true)
            }, msg.delay - 600)
          )
        }

        timeouts.push(
          setTimeout(() => {
            setIsTyping(false)
            setMessages(prev => [...prev, msg])
          }, msg.delay)
        )
      })

      // Loop the sequence
      timeouts.push(
        setTimeout(() => {
          runSequence()
        }, CHAT_SEQUENCE[CHAT_SEQUENCE.length - 1].delay + 4000)
      )
    }

    runSequence()

    return () => timeouts.forEach(clearTimeout)
  }, [])

  return (
    <section className="relative overflow-hidden bg-transparent pt-28 pb-20 sm:pt-40 sm:pb-24">
      {/* Premium Dark Background Gradients */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#092276] rounded-full mix-blend-screen filter blur-[120px] opacity-30 animate-pulse-slow"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-[#092276] rounded-full mix-blend-screen filter blur-[100px] opacity-20"></div>
        <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.03] mix-blend-overlay"></div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="flex flex-col items-center text-center max-w-4xl mx-auto mb-20">
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 shadow-sm text-slate-300 text-xs font-medium mb-8">
              <Sparkles className="h-3 w-3 text-[#5c8cff]" />
              <span>v2.0 Automation Engine</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-extrabold text-white tracking-tight leading-[1.05] mb-6">
              Turn conversations into <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-slate-200 to-slate-500">
                loyal customers.
              </span>
            </h1>
            
            <p className="text-lg md:text-xl text-slate-400 mb-10 leading-relaxed font-light max-w-2xl mx-auto">
              A complete suite of AI-powered tools wrapped in a stunning interface. <br className="hidden md:block"/>
              Recover abandoned carts instantly and provide support that feels beautifully human.
            </p>
            
            <div className="flex justify-center">
              <Link href="/login">
                <Button size="lg" className="h-12 px-6 text-sm font-medium bg-white/10 border border-white/20 text-white hover:bg-white/20 hover:border-white/30 rounded-xl shadow-lg backdrop-blur-md transition-all flex items-center gap-2">
                  Start your free trial <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>

        {/* Features Marquee */}
        <div className="w-full border-y border-white/5 bg-white/[0.02] py-4 mb-20 flex overflow-hidden whitespace-nowrap relative">
          <div className="absolute left-0 w-32 h-full bg-gradient-to-r from-[#0a0d14] to-transparent z-10 pointer-events-none"></div>
          <div className="absolute right-0 w-32 h-full bg-gradient-to-l from-[#0a0d14] to-transparent z-10 pointer-events-none"></div>
          
          <motion.div 
            className="flex items-center gap-12 font-medium text-slate-400 text-sm tracking-wide px-6"
            animate={{ x: ["0%", "-50%"] }}
            transition={{ ease: "linear", duration: 30, repeat: Infinity }}
          >
            {/* Duplicated for smooth infinite scroll */}
            {[...Array(2)].map((_, i) => (
              <div key={i} className="flex items-center gap-12">
                <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-[#092276]"></div> Omnichannel Inbox</div>
                <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-[#092276]"></div> Visual Automation Builder</div>
                <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-[#092276]"></div> AI Smart Assistant</div>
                <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-[#092276]"></div> Abandoned Cart Recovery</div>
                <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-[#092276]"></div> Order Status Updates</div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Dark Interactive Chat Mockup */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
          className="relative max-w-4xl mx-auto"
        >
          <div className="relative rounded-2xl bg-[#0b141a] border border-white/10 shadow-[0_0_80px_rgba(9,34,118,0.15)] overflow-hidden h-[500px] flex flex-col">
            
            {/* Dark WhatsApp Header */}
            <div className="bg-[#202c33] px-6 py-3 flex items-center gap-4 border-b border-white/5 z-10">
              <div className="h-10 w-10 rounded-full bg-[#092276]/20 flex items-center justify-center overflow-hidden p-1 border border-white/5">
                <img src="/chatflow-logo.png" alt="Chatflow" className="w-full h-full object-contain brightness-200" />
              </div>
              <div>
                <h3 className="text-white font-medium text-base">Chatflow Demo</h3>
                <p className="text-slate-400 text-xs">typically replies instantly</p>
              </div>
              <div className="ml-auto flex gap-4">
                <div className="h-5 w-5 text-slate-400 rounded-full border-[1.5px] border-current"></div>
                <div className="h-5 w-1 text-slate-400 flex flex-col justify-between items-center py-1">
                  <div className="w-[3px] h-[3px] bg-current rounded-full"></div>
                  <div className="w-[3px] h-[3px] bg-current rounded-full"></div>
                  <div className="w-[3px] h-[3px] bg-current rounded-full"></div>
                </div>
              </div>
            </div>

            {/* Dark Chat Area */}
            <div className="flex-1 p-6 overflow-y-auto bg-[#0b141a] relative flex flex-col gap-4" style={{ backgroundImage: "url('/images/doodle-dark.png')", backgroundSize: 'cover', backgroundBlendMode: 'overlay', opacity: 0.9 }}>
              
              <AnimatePresence>
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.3 }}
                    className={`flex w-full ${msg.type === 'system' ? 'justify-center' : msg.type === 'bot' ? 'justify-start' : 'justify-end'}`}
                  >
                    {msg.type === 'system' ? (
                      <div className="bg-[#182229] px-4 py-1.5 rounded-lg text-[11px] font-medium text-slate-400 shadow-sm border border-white/5">
                        {msg.text}
                      </div>
                    ) : (
                      <div className={`max-w-[75%] rounded-lg px-3 py-2 shadow-sm ${msg.type === 'bot' ? 'bg-[#202c33] text-slate-200' : 'bg-[#005c4b] text-white'}`}>
                        <p className="text-[14px] leading-relaxed">{msg.text}</p>
                        {msg.link && (
                          <div className="mt-2 pt-2 border-t border-white/5">
                            <span className="text-[#53bdeb] font-medium text-sm flex items-center gap-1 cursor-pointer">
                              {msg.link} <ArrowRight className="h-3 w-3" />
                            </span>
                          </div>
                        )}
                        <div className={`text-[10px] text-right mt-1 opacity-60 ${msg.type === 'bot' ? 'text-slate-400' : 'text-slate-300'}`}>
                          {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))}

                {isTyping && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex justify-start w-full"
                  >
                    <div className="bg-[#202c33] rounded-lg px-4 py-3 shadow-sm flex gap-1.5 items-center">
                      <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce"></div>
                      <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              
              <div className="mt-auto"></div>
            </div>
            
            {/* Dark Input Area */}
            <div className="bg-[#202c33] px-4 py-3 flex items-center gap-3 border-t border-white/5">
              <div className="h-8 w-8 flex items-center justify-center text-slate-400">
                <span className="text-2xl font-light">+</span>
              </div>
              <div className="flex-1 bg-[#2a3942] h-10 rounded-lg px-4 flex items-center">
                <span className="text-slate-400 text-sm">Type a message</span>
              </div>
              <div className="h-10 w-10 rounded-full bg-[#00a884] flex items-center justify-center text-white shadow-sm">
                <MessageCircle className="h-5 w-5 ml-0.5" />
              </div>
            </div>

          </div>
        </motion.div>

      </div>
    </section>
  )
}
