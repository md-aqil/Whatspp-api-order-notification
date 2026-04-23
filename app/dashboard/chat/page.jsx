'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ChatWindow } from '@/components/dashboard/ChatWindow'
import { ChatList } from '@/components/dashboard/ChatList'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export default function DashboardChatPage() {
  const router = useRouter()
  const [chats, setChats] = useState([])
  const [activeChat, setActiveChat] = useState(null)
  const [loading, setLoading] = useState(true)
  const [messages, setMessages] = useState([])
  const [waAccounts, setWaAccounts] = useState([])
  const [selectedAccountId, setSelectedAccountId] = useState(null)
  const [authError, setAuthError] = useState('')
  const pollingIntervalRef = useRef(null)
  const lastMessageCountRef = useRef(0)

  const handleAuthFailure = (message = 'Your session expired. Please sign in again.') => {
    setAuthError(message)
    setChats([])
    setMessages([])
    setActiveChat(null)
    toast.error(message)
  }

  // Load chats from the database
  useEffect(() => {
    const loadChats = async () => {
      try {
        setLoading(true)
        setAuthError('')
        const response = await fetch('/api/chats')
        if (response.ok) {
          const data = await response.json()
          setChats(data)
          if (data.length > 0 && !activeChat) {
            setActiveChat(data[0])
          }
        } else if (response.status === 401) {
          handleAuthFailure()
        } else {
          throw new Error('Failed to load chats')
        }
      } catch (error) {
        console.error('Failed to load chats:', error)
        setChats([])
        setActiveChat(null)
      } finally {
        setLoading(false)
      }
    }

    loadChats()
  }, [])

  // Load WhatsApp accounts
  useEffect(() => {
    const loadWaAccounts = async () => {
      try {
        const response = await fetch('/api/whatsapp-accounts')
        if (response.ok) {
          const data = await response.json()
          setWaAccounts(data.accounts || [])
          if (data.accounts?.length > 0) {
            setSelectedAccountId(data.accounts[0].id)
          }
        }
      } catch (error) {
        console.error('Failed to load WhatsApp accounts:', error)
      }
    }
    loadWaAccounts()
  }, [])

  // Load and poll messages for the active chat
  useEffect(() => {
    if (!activeChat) return

    const fetchMessages = async () => {
      try {
        const response = await fetch(`/api/chats/${activeChat.phone}/messages`)
        if (response.ok) {
          const data = await response.json()
          
          // Only update if message count changed
          if (data.length !== lastMessageCountRef.current) {
            // Count is updated, ChatList will reflect unread status
            setMessages(data)
            lastMessageCountRef.current = data.length
          }
        } else if (response.status === 401) {
          handleAuthFailure()
          if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current)
        }
      } catch (error) {
        console.error('Failed to fetch messages:', error)
      }
    }

    // Initial load
    fetchMessages()
    
    // Set up polling (3 seconds)
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
    }
    
    pollingIntervalRef.current = setInterval(fetchMessages, 3000)

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
    }
  }, [activeChat])

  const handleSelectChat = (chat) => {
    setActiveChat(chat)
    lastMessageCountRef.current = 0 // Reset to trigger full sync
    setChats(prev => prev.map(c => 
      c.id === chat.id ? { ...c, unread: 0 } : c
    ))
  }

  const handleSendMessage = async (messageText) => {
    if (!activeChat || !messageText.trim()) return

    try {
      const response = await fetch('/api/send-whatsapp-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: activeChat.phone,
          message: messageText,
          accountId: selectedAccountId
        })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to send message')
      }
      
      const result = await response.json()
      
      // Update local state immediately for snappy feel
      if (result.message) {
        setMessages(prev => [...prev, result.message])
        lastMessageCountRef.current = lastMessageCountRef.current + 1
      }
      
      // Update chat list last message
      setChats(prev => prev.map(chat => 
        chat.phone === activeChat.phone 
          ? { ...chat, lastMessage: messageText, timestamp: new Date() }
          : chat
      ))
      
    } catch (error) {
      console.error('Failed to send message:', error)
      toast.error(error.message)
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50 dark:bg-[#0b0d14]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
          <p className="text-slate-500 dark:text-white/40">Loading your conversations...</p>
        </div>
      </div>
    )
  }

  if (authError) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50 dark:bg-[#0b0d14]">
        <div className="max-w-md rounded-2xl border border-rose-100 bg-white p-8 text-center shadow-sm dark:border-rose-500/10 dark:bg-[#11131d]">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Session Expired</h2>
          <p className="mt-2 text-slate-500 dark:text-white/50">{authError}</p>
          <Button className="mt-6 bg-emerald-600 hover:bg-emerald-700" onClick={() => router.push('/login')}>
            Sign in again
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100%+2rem)] md:h-[calc(100%+3rem)] -m-4 md:-m-6 w-[calc(100%+2rem)] md:w-[calc(100%+3rem)] overflow-hidden bg-white dark:bg-[#0b0d14]">
      
      {/* Sidebar */}
      <div className="w-[320px] lg:w-[380px] flex-shrink-0 z-30 border-r border-gray-100 hidden md:flex flex-col">
        <ChatList 
          chats={chats} 
          activeChatId={activeChat?.id} 
          onSelectChat={handleSelectChat} 
        />
      </div>
      
      {/* Content */}
      <div className="flex-1 min-w-0 relative bg-[#f9fafb]">
        {activeChat ? (
          <ChatWindow 
            chat={activeChat} 
            messages={messages} 
            onSendMessage={handleSendMessage} 
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center bg-white">
            <div className="flex flex-col items-center max-w-md text-center px-8">
              <div className="relative mb-10">
                <div className="absolute -inset-4 bg-emerald-500/5 rounded-full blur-2xl animate-pulse"></div>
                <div className="relative h-28 w-28 rounded-3xl bg-emerald-50 flex items-center justify-center shadow-xl shadow-emerald-500/5 border border-emerald-100">
                  <MessageSquare className="w-12 h-12 text-emerald-600" />
                </div>
              </div>
              <h3 className="text-2xl font-black text-gray-900 mb-3 tracking-tight">Select a Chat</h3>
              <p className="text-gray-500 text-sm leading-relaxed mb-8">
                Pick a conversation from the left to start responding to your customers in real-time.
              </p>
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-emerald-600 bg-emerald-50 px-4 py-2 rounded-full border border-emerald-100">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                Real-time Sync Active
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
