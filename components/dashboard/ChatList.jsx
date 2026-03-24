'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Plus } from 'lucide-react'

export function ChatList({ chats, activeChatId, onSelectChat }) {
  const [showNewChatDialog, setShowNewChatDialog] = useState(false)
  const [newPhoneNumber, setNewPhoneNumber] = useState('')
  const [newContactName, setNewContactName] = useState('')

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
      return format(messageDate, 'MMM d')
    }
  }

  const handleCreateNewChat = async () => {
    if (!newPhoneNumber.trim()) return

    try {
      // Create a new chat via API
      const requestBody = {
        phone: newPhoneNumber
      }
      
      // Only add name to request if it's provided
      if (newContactName.trim()) {
        requestBody.name = newContactName.trim()
      }

      const response = await fetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        throw new Error('Failed to create chat')
      }

      const newChat = await response.json()
      onSelectChat(newChat)
      setShowNewChatDialog(false)
      setNewPhoneNumber('')
      setNewContactName('')
    } catch (error) {
      console.error('Failed to create new chat:', error)
    }
  }

  return (
    <div className="flex h-full flex-col rounded-[1.5rem] border border-slate-200/70 bg-white/90 shadow-[0_24px_50px_-36px_rgba(5,52,92,0.45)] dark:border-white/[0.06] dark:bg-[#0d0f17] dark:shadow-none">
      <div className="flex items-center justify-between border-b border-slate-200/70 bg-slate-50/80 p-3 dark:border-white/[0.06] dark:bg-white/[0.03]">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-400 dark:text-white/25">Inbox</p>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Chats</h2>
        </div>
        <Dialog open={showNewChatDialog} onOpenChange={setShowNewChatDialog}>
          <DialogTrigger asChild>
            <Button size="sm" variant="ghost" className="rounded-full border border-slate-200/70 bg-white/80 p-2 text-slate-700 shadow-sm hover:bg-slate-100 dark:border-white/[0.08] dark:bg-white/[0.05] dark:text-white/70 dark:hover:bg-white/[0.08]" onClick={() => setShowNewChatDialog(true)}>
              <Plus className="w-5 h-5" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Chat</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label htmlFor="name" className="mb-1 block text-sm font-medium text-slate-700 dark:text-white/70">
                  Contact Name (Optional)
                </label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Customer Name"
                  value={newContactName}
                  onChange={(e) => setNewContactName(e.target.value)}
                  className="w-full"
                />
              </div>
              <div>
                <label htmlFor="phone" className="mb-1 block text-sm font-medium text-slate-700 dark:text-white/70">
                  Phone Number
                </label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+1234567890"
                  value={newPhoneNumber}
                  onChange={(e) => setNewPhoneNumber(e.target.value)}
                  className="w-full"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setShowNewChatDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateNewChat}>
                  Create Chat
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="flex-1 overflow-y-auto">
        {chats.map((chat) => (
          <div
            key={chat.id}
            className={`flex cursor-pointer items-center border-b border-slate-200/60 p-3 transition-colors hover:bg-slate-50 dark:border-white/[0.06] dark:hover:bg-white/[0.04] ${
              activeChatId === chat.id ? 'bg-[#eff4ff] dark:bg-violet-600/10' : ''
            }`}
            onClick={() => onSelectChat(chat)}
          >
            <div className="relative flex-shrink-0">
              <img
                src={chat.avatar}
                alt={chat.name}
                className="w-12 h-12 rounded-full object-cover"
              />
              {chat.unread > 0 && (
                <div className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-xs text-white">
                  {chat.unread}
                </div>
              )}
            </div>
            <div className="ml-3 flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h3 className="truncate text-sm font-medium text-slate-900 dark:text-white">
                  {chat.name}
                </h3>
                <span className="text-xs text-slate-500 dark:text-white/35">
                  {formatDate(chat.timestamp)}
                </span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <p className="truncate text-sm text-slate-500 dark:text-white/45">
                  {chat.lastMessage}
                </p>
                {chat.unread > 0 && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-xs text-white">
                    {chat.unread}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
