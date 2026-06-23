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
    <section className="relative overflow-hidden bg-white pt-24 pb-32 sm:pt-32 sm:pb-40">
      {/* Elegant Background Gradients */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-0 -left-4 w-72 h-72 bg-emerald-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
        <div className="absolute top-0 -right-4 w-72 h-72 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-green-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          
          {/* Text Content */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="max-w-2xl"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-50 border border-slate-100 shadow-sm text-slate-600 text-sm font-medium mb-8">
              <Sparkles className="h-4 w-4 text-emerald-500" />
              <span>The Next Generation of E-Commerce Support</span>
            </div>
            
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-slate-900 tracking-tight leading-[1.1] mb-8">
              Turn conversations into <br />
              <span className="relative">
                <span className="relative z-10 text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-green-500">
                  loyal customers
                </span>
                <span className="absolute bottom-0 left-0 w-full h-3 bg-emerald-100 -z-10 transform -rotate-1"></span>
              </span>
            </h1>
            
            <p className="text-xl text-slate-600 mb-10 leading-relaxed font-light">
              Chatflow combines the power of Shopify with WhatsApp. Recover abandoned carts instantly, automate order updates, and provide AI-driven support that feels beautifully human.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <Link href="/login" className="w-full sm:w-auto">
                <Button size="lg" className="h-14 px-8 w-full text-base font-medium bg-slate-900 text-white hover:bg-slate-800 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.12)] transition-all hover:scale-105">
                  Start your free trial
                </Button>
              </Link>
              <Link href="#how-it-works" className="w-full sm:w-auto">
                <Button size="lg" variant="ghost" className="h-14 px-8 w-full text-base font-medium text-slate-600 hover:bg-slate-50 rounded-full">
                  See how it works
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>

            <div className="mt-10 flex items-center gap-6 text-sm text-slate-500 font-medium">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" /> No credit card required
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" /> 14-day free trial
              </div>
            </div>
          </motion.div>

          {/* Interactive Chat Mockup */}
          <motion.div 
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
            className="relative"
          >
            <div className="relative rounded-[2rem] bg-[#F0F2F5] border border-slate-200 shadow-[0_20px_50px_rgba(8,_112,_184,_0.07)] overflow-hidden h-[600px] flex flex-col">
              
              {/* WhatsApp Header */}
              <div className="bg-[#00A884] px-6 py-4 flex items-center gap-4 shadow-sm z-10">
                <div className="h-10 w-10 rounded-full bg-white flex items-center justify-center shadow-sm overflow-hidden p-1">
                  <img src="/chatflow-logo.png" alt="Chatflow" className="w-full h-full object-contain" />
                </div>
                <div>
                  <h3 className="text-white font-semibold text-base">Chatflow Demo</h3>
                  <p className="text-emerald-100 text-xs">typically replies instantly</p>
                </div>
                <div className="ml-auto flex gap-4">
                  <div className="h-5 w-5 text-white opacity-80 rounded-full border-2 border-current"></div>
                  <div className="h-5 w-1 text-white opacity-80 flex flex-col justify-between items-center py-1">
                    <div className="w-1 h-1 bg-current rounded-full"></div>
                    <div className="w-1 h-1 bg-current rounded-full"></div>
                    <div className="w-1 h-1 bg-current rounded-full"></div>
                  </div>
                </div>
              </div>

              {/* Chat Area */}
              <div className="flex-1 p-6 overflow-y-auto bg-[url('/images/doodle-light.jpg')] bg-cover bg-opacity-5 relative flex flex-col gap-4">
                
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
                        <div className="bg-white/80 backdrop-blur-sm px-4 py-1.5 rounded-full text-xs font-medium text-slate-500 shadow-sm border border-slate-100">
                          {msg.text}
                        </div>
                      ) : (
                        <div className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm ${msg.type === 'bot' ? 'bg-white rounded-tl-sm text-slate-800' : 'bg-[#D9FDD3] rounded-tr-sm text-slate-800'}`}>
                          <p className="text-[15px] leading-relaxed">{msg.text}</p>
                          {msg.link && (
                            <div className="mt-3 pt-3 border-t border-slate-100">
                              <span className="text-blue-500 font-medium text-sm flex items-center gap-1 cursor-pointer">
                                {msg.link} <ArrowRight className="h-3 w-3" />
                              </span>
                            </div>
                          )}
                          <div className={`text-[10px] text-right mt-1 opacity-60 ${msg.type === 'bot' ? 'text-slate-500' : 'text-slate-600'}`}>
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
                      <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm flex gap-1.5 items-center">
                        <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></div>
                        <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                
                {/* Scroll anchor */}
                <div className="mt-auto"></div>
              </div>
              
              {/* Input Area Mockup */}
              <div className="bg-[#F0F2F5] px-4 py-3 flex items-center gap-3 border-t border-slate-200">
                <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 cursor-not-allowed">
                  <span className="text-xl">+</span>
                </div>
                <div className="flex-1 bg-white h-10 rounded-full px-4 flex items-center border border-slate-200 shadow-inner">
                  <span className="text-slate-400 text-sm">Type a message...</span>
                </div>
                <div className="h-10 w-10 rounded-full bg-[#00A884] flex items-center justify-center text-white shadow-sm cursor-not-allowed">
                  <MessageCircle className="h-5 w-5 ml-1" />
                </div>
              </div>

            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
