'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ArrowRight, MessageCircle, Sparkles, CheckCircle2, Send, Package, ShoppingBag, HelpCircle, UserCheck } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'

export default function HeroSection() {
  const [messages, setMessages] = useState([
    {
      id: 'init-1',
      type: 'bot',
      text: 'Hello Alex, welcome to our store! 👋\n\nHow can we assist you today? Please choose an option below:',
      buttons: ['📦 Order Status', '👗 Shop Collection', '❓ Help & FAQs', '💬 Talk to Specialist']
    }
  ])
  const [inputText, setInputText] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const chatScrollRef = useRef(null)

  const handleOptionClick = (label) => {
    setMessages(prev => [...prev, {
      id: String(Date.now()),
      type: 'user',
      text: label
    }])
    setIsTyping(true)

    setTimeout(() => {
      setIsTyping(false)
      if (label.includes('Order Status') || label.includes('Track')) {
        setMessages(prev => [
          ...prev,
          {
            id: String(Date.now() + 1),
            type: 'bot',
            card: {
              orderNumber: '1042',
              status: 'OUT FOR DELIVERY',
              progress: 80,
              items: '1x Premium Leather Jacket, 2x Cotton T-Shirt',
              total: '$89.00',
              buttons: ['📍 Live Tracking Link', '💬 Need Help']
            }
          }
        ])
      } else if (label.includes('Shop Collection')) {
        setMessages(prev => [
          ...prev,
          {
            id: String(Date.now() + 1),
            type: 'bot',
            text: 'Here are our top trending collections this week! 🛍️✨ Which category are you shopping for?',
            buttons: ['👚 Women\'s Apparel', '👔 Men\'s Collection', '🎒 Accessories']
          }
        ])
      } else if (label.includes('Help & FAQs') || label.includes('FAQ')) {
        setMessages(prev => [
          ...prev,
          {
            id: String(Date.now() + 1),
            type: 'bot',
            text: 'I can answer any question instantly! What would you like to know?',
            buttons: ['🔄 30-Day Returns', '🚚 Shipping Speeds', '💳 Payment Methods']
          }
        ])
      } else if (label.includes('Specialist') || label.includes('Need Help')) {
        setMessages(prev => [
          ...prev,
          {
            id: String(Date.now() + 1),
            type: 'bot',
            text: '👨‍💻 Connecting you with a member of our specialist team. An agent will respond in under 2 minutes!'
          }
        ])
      } else {
        setMessages(prev => [
          ...prev,
          {
            id: String(Date.now() + 1),
            type: 'bot',
            text: `You selected "${label}". How else can we assist you today? ✨`,
            buttons: ['📦 Order Status', '👗 Shop Collection']
          }
        ])
      }
    }, 600)
  }

  const handleSendText = (e) => {
    e?.preventDefault()
    if (!inputText.trim()) return
    const text = inputText.trim()
    setInputText('')

    setMessages(prev => [...prev, {
      id: String(Date.now()),
      type: 'user',
      text
    }])
    setIsTyping(true)

    setTimeout(() => {
      setIsTyping(false)
      const orderMatch = text.match(/\d{3,8}/)
      if (orderMatch || text.toLowerCase().includes('order') || text.toLowerCase().includes('track') || text.toLowerCase().includes('status')) {
        const orderNum = orderMatch ? orderMatch[0] : '1042'
        setMessages(prev => [
          ...prev,
          {
            id: String(Date.now() + 1),
            type: 'bot',
            card: {
              orderNumber: orderNum,
              status: 'IN TRANSIT (OUT FOR DELIVERY)',
              progress: 80,
              items: '1x Premium Leather Jacket (Size L)',
              total: '$89.00',
              buttons: ['📍 Live Tracking Link', '💬 Need Help']
            }
          }
        ])
      } else if (text.toLowerCase() === 'hi' || text.toLowerCase() === 'hello') {
        setMessages(prev => [
          ...prev,
          {
            id: String(Date.now() + 1),
            type: 'bot',
            text: 'Hello! 👋 Welcome to our official WhatsApp store assistant. How can we help you?',
            buttons: ['📦 Order Status', '👗 Shop Collection', '💬 Talk to Specialist']
          }
        ])
      } else {
        setMessages(prev => [
          ...prev,
          {
            id: String(Date.now() + 1),
            type: 'bot',
            text: `Thanks for your message: "${text}"! 👋\n\nHow can we help you today?`,
            buttons: ['📦 Order Status', '👗 Shop Collection', '💬 Talk to Specialist']
          }
        ])
      }
    }, 600)
  }

  useEffect(() => {
    chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, isTyping])

  return (
    <section className="relative overflow-hidden bg-transparent pt-28 pb-20 sm:pt-40 sm:pb-24">
      {/* Premium Dark Background Gradients */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#092276] rounded-full mix-blend-screen filter blur-[120px] opacity-30 animate-pulse-slow"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-[#092276] rounded-full mix-blend-screen filter blur-[100px] opacity-20"></div>
        <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.03] mix-blend-overlay"></div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="flex flex-col items-center text-center max-w-4xl mx-auto mb-16">
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 shadow-sm text-emerald-400 text-xs font-semibold mb-8">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Interactive Live WhatsApp Bot Experience</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-extrabold text-white tracking-tight leading-[1.05] mb-6">
              Turn conversations into <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-indigo-400">
                loyal customers.
              </span>
            </h1>
            
            <p className="text-lg md:text-xl text-slate-400 mb-10 leading-relaxed font-light max-w-2xl mx-auto">
              Automate live order status tracking, Cash on Delivery verification, abandoned cart recovery, and broadcast marketing directly on WhatsApp.
            </p>
            
            <div className="flex justify-center gap-3">
              <Link href="/login">
                <Button size="lg" className="h-12 px-7 text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-900/30 transition-all flex items-center gap-2">
                  Get Started Free <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>

        {/* Features Marquee */}
        <div className="w-full border-y border-white/5 bg-white/[0.02] py-3.5 mb-16 flex overflow-hidden whitespace-nowrap relative">
          <div className="absolute left-0 w-32 h-full bg-gradient-to-r from-[#0a0d14] to-transparent z-10 pointer-events-none"></div>
          <div className="absolute right-0 w-32 h-full bg-gradient-to-l from-[#0a0d14] to-transparent z-10 pointer-events-none"></div>
          
          <motion.div 
            className="flex items-center gap-12 font-medium text-slate-400 text-sm tracking-wide px-6"
            animate={{ x: ["0%", "-50%"] }}
            transition={{ ease: "linear", duration: 30, repeat: Infinity }}
          >
            {[...Array(2)].map((_, i) => (
              <div key={i} className="flex items-center gap-12">
                <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> Instant Order Status</div>
                <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> Anti-RTO COD Verification</div>
                <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> Automated Cart Recovery</div>
                <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> Broadcast Studio</div>
                <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> Omnichannel Live Inbox</div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Interactive Live WhatsApp Bot Showcase */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
          className="relative max-w-3xl mx-auto"
        >
          <div className="relative rounded-3xl bg-[#0b141a] border border-white/10 shadow-[0_0_100px_rgba(16,185,129,0.15)] overflow-hidden h-[540px] flex flex-col">
            
            {/* WhatsApp App Bar */}
            <div className="bg-[#202c33] px-5 py-3.5 flex items-center justify-between border-b border-white/5 z-10">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-sm shadow">
                  VF
                </div>
                <div>
                  <h3 className="text-white font-bold text-sm flex items-center gap-1.5">
                    Vaclav Fashion
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400 text-black" />
                  </h3>
                  <p className="text-emerald-400 text-[11px] font-medium">Online • Instant automated replies</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2.5 py-1 rounded-full border border-emerald-500/30">
                  Interactive Demo
                </span>
              </div>
            </div>

            {/* Chat Area */}
            <div 
              ref={chatScrollRef}
              className="flex-1 p-5 overflow-y-auto bg-[#0b141a] relative flex flex-col gap-3.5"
            >
              <div className="text-center my-1">
                <span className="text-[10px] bg-[#182229] text-white/50 px-3 py-1 rounded-md border border-white/5 font-medium">
                  TODAY • LIVE WHATSAPP BOT SESSION
                </span>
              </div>

              <AnimatePresence>
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.25 }}
                    className={`flex flex-col ${msg.type === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    {msg.text && (
                      <div className={`max-w-[85%] rounded-2xl p-3.5 text-[13px] leading-relaxed shadow-md ${
                        msg.type === 'user'
                          ? 'bg-[#005c4b] text-white rounded-tr-xs'
                          : 'bg-[#202c33] text-white/95 rounded-tl-xs border border-white/5'
                      }`}>
                        <p className="whitespace-pre-wrap">{msg.text}</p>
                        <div className={`text-[9.5px] text-right mt-1.5 ${msg.type === 'user' ? 'text-emerald-200/60' : 'text-white/30'}`}>
                          Just now
                        </div>
                      </div>
                    )}

                    {/* Rich Order Status Card */}
                    {msg.card && (
                      <div className="max-w-[92%] bg-[#202c33] border border-emerald-500/30 rounded-2xl rounded-tl-xs p-4 text-white shadow-xl space-y-3">
                        <div className="flex items-center justify-between border-b border-white/10 pb-2">
                          <div className="flex items-center gap-2 font-bold text-xs text-white">
                            <span>📦</span> Order #{msg.card.orderNumber}
                          </div>
                          <span className="text-[9.5px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30">
                            {msg.card.status}
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[10px] text-white/60 font-medium">
                            <span>Placed</span>
                            <span>Shipped</span>
                            <span className="text-emerald-400 font-bold">Out for Delivery</span>
                            <span>Delivered</span>
                          </div>
                          <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                            <div className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full" style={{ width: `${msg.card.progress}%` }} />
                          </div>
                        </div>

                        <div className="bg-black/30 p-2.5 rounded-xl border border-white/5 space-y-1 text-xs">
                          <div className="text-white/90 font-medium">{msg.card.items}</div>
                          <div className="text-white/40 text-[11px]">Total: <strong className="text-emerald-300 font-bold">{msg.card.total}</strong> • Paid via Shopify</div>
                        </div>

                        {/* Interactive Action Buttons */}
                        {msg.card.buttons && (
                          <div className="pt-1 space-y-2 border-t border-white/10">
                            {msg.card.buttons.map((btnLabel, bIdx) => (
                              <button
                                key={bIdx}
                                type="button"
                                onClick={() => handleOptionClick(btnLabel)}
                                className="w-full py-2 px-3 bg-[#111b21] hover:bg-[#182229] active:scale-[0.98] border border-white/10 rounded-xl text-emerald-400 text-xs font-bold transition-all shadow flex items-center justify-center gap-1.5"
                              >
                                {btnLabel}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Quick Reply Option Buttons */}
                    {msg.buttons && msg.buttons.length > 0 && (
                      <div className="w-full max-w-[85%] mt-2 space-y-2">
                        {msg.buttons.map((btnLabel, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleOptionClick(btnLabel)}
                            className="w-full py-2.5 px-3.5 bg-[#182229] hover:bg-[#222e35] active:scale-[0.98] border border-emerald-500/20 hover:border-emerald-400/40 rounded-xl text-emerald-300 text-xs font-bold transition-all shadow flex items-center justify-center gap-1.5 text-center"
                          >
                            {btnLabel}
                          </button>
                        ))}
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
                    <div className="bg-[#202c33] rounded-2xl rounded-tl-xs px-3.5 py-2.5 shadow-md flex gap-1.5 items-center border border-white/5">
                      <div className="w-1.5 h-1.5 bg-white/60 rounded-full animate-bounce"></div>
                      <div className="w-1.5 h-1.5 bg-white/60 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                      <div className="w-1.5 h-1.5 bg-white/60 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            {/* Input Area */}
            <form onSubmit={handleSendText} className="bg-[#202c33] p-3 flex items-center gap-2 border-t border-white/5">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Type a message, or try '#1042'..."
                className="flex-1 bg-[#2a3942] border border-transparent focus:border-emerald-500/50 rounded-2xl px-4 py-2.5 text-xs text-white placeholder:text-white/30 outline-none"
              />
              <Button
                type="submit"
                size="icon"
                disabled={!inputText.trim()}
                className="h-9 w-9 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white shrink-0 shadow disabled:opacity-30"
              >
                <Send className="w-4 h-4" />
              </Button>
            </form>

          </div>
        </motion.div>

      </div>
    </section>
  )
}
