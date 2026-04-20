'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Plus, Search, MoreVertical, MessageSquare } from 'lucide-react'

export function ChatList({ chats, activeChatId, onSelectChat }) {
  const [showNewChatDialog, setShowNewChatDialog] = useState(false)
  const [newPhoneNumber, setNewPhoneNumber] = useState('')
  const [newContactName, setNewContactName] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  const formatTime = (date) => {
    return format(new Date(date), 'h:mm a')
  }

  const formatDate = (date) => {
    const today = new Date()
    const messageDate = new Date(date)
    
    if (messageDate.toDateString() === today.toDateString()) {
      return formatTime(date)
    } else if (messageDate > new Date(today.setDate(today.getDate() - 1))) {
      return 'Yesterday'
    } else {
      return format(messageDate, 'dd/MM/yy')
    }
  }

  const handleCreateNewChat = async () => {
    if (!newPhoneNumber.trim()) return

    try {
      const requestBody = { phone: newPhoneNumber }
      if (newContactName.trim()) requestBody.name = newContactName.trim()

      const response = await fetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) throw new Error('Failed to create chat')

      const newChat = await response.json()
      onSelectChat(newChat)
      setShowNewChatDialog(false)
      setNewPhoneNumber('')
      setNewContactName('')
    } catch (error) {
      console.error('Failed to create new chat:', error)
    }
  }

  const filteredChats = chats.filter(chat => 
    chat.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    chat.phone.includes(searchQuery)
  )

  return (
    <div className="flex h-full flex-col bg-white dark:bg-[#0b0d14] border-r border-gray-100 dark:border-slate-800">
      {/* List Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-gray-50 dark:border-slate-800 bg-[#f9fafb] dark:bg-[#111827]/50">
        <h2 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">Messages</h2>
        <div className="flex items-center space-x-2">
          <Dialog open={showNewChatDialog} onOpenChange={setShowNewChatDialog}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10">
                <Plus className="w-5 h-5" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[400px] bg-white dark:bg-[#111827] text-gray-900 dark:text-white border-none shadow-2xl rounded-3xl">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold tracking-tight">New Conversation</DialogTitle>
              </DialogHeader>
              <div className="space-y-5 py-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-gray-400 ml-1">Recipient Name</label>
                  <Input
                    placeholder="e.g. John Doe"
                    value={newContactName}
                    onChange={(e) => setNewContactName(e.target.value)}
                    className="h-12 bg-gray-50 dark:bg-slate-800 border-none focus-visible:ring-emerald-500 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-gray-400 ml-1">Phone Number</label>
                  <Input
                    placeholder="e.g. 919876543210"
                    value={newPhoneNumber}
                    onChange={(e) => setNewPhoneNumber(e.target.value)}
                    className="h-12 bg-gray-50 dark:bg-slate-800 border-none focus-visible:ring-emerald-500 rounded-xl"
                  />
                </div>
                <Button 
                  onClick={handleCreateNewChat} 
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl h-12 shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98]"
                >
                  Create Chat
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search */}
      <div className="p-4 border-b border-gray-50 dark:border-slate-800">
        <div className="relative group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-emerald-500 transition-colors" />
          <Input 
            placeholder="Search conversations..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-11 bg-gray-50 dark:bg-slate-800/50 border-none focus-visible:ring-emerald-500 rounded-xl placeholder:text-gray-400"
          />
        </div>
      </div>

      {/* Chat Items */}
      <div className="flex-1 overflow-y-auto">
        {filteredChats.map((chat) => (
          <button
            key={chat.id}
            onClick={() => onSelectChat(chat)}
            className={`w-full flex items-center px-6 py-4 transition-all duration-200 border-b border-gray-50 dark:border-slate-800/50 ${
              activeChatId === chat.id 
                ? 'bg-emerald-50/50 dark:bg-emerald-500/10 border-r-4 border-r-emerald-500' 
                : 'bg-white dark:bg-transparent hover:bg-gray-50 dark:hover:bg-slate-800/50'
            }`}
          >
            <div className="relative flex-shrink-0">
              <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl overflow-hidden shadow-sm border border-gray-100 dark:border-slate-700">
                <img
                  src={chat.avatar || `https://i.pravatar.cc/150?u=${chat.phone}`}
                  alt={chat.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white dark:border-[#0b0d14] rounded-full"></div>
            </div>
            
            <div className="ml-4 flex-1 min-w-0 text-left">
              <div className="flex justify-between items-baseline mb-1">
                <h3 className={`font-bold truncate tracking-tight ${
                  activeChatId === chat.id ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-900 dark:text-white'
                }`}>
                  {chat.name}
                </h3>
                <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 whitespace-nowrap ml-2">
                  {formatDate(chat.timestamp)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <p className={`text-sm truncate ${
                  chat.unread > 0 ? 'text-gray-900 dark:text-white font-bold' : 'text-gray-500 dark:text-gray-400'
                }`}>
                  {chat.lastMessage || 'No messages yet'}
                </p>
                {chat.unread > 0 && (
                  <span className="ml-2 bg-emerald-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm shadow-emerald-500/20">
                    {chat.unread}
                  </span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
