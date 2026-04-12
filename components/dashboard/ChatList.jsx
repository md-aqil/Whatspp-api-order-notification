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
    <div className="flex h-full flex-col bg-white dark:bg-[#111b21] border-r border-gray-200 dark:border-white/5">
      {/* List Header */}
      <div className="flex items-center justify-between bg-[#f0f2f5] dark:bg-[#202c33] px-4 py-2">
        <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden cursor-pointer hover:bg-slate-300 transition-colors">
          <img src="https://i.pravatar.cc/150?u=me" alt="Me" className="w-full h-full object-cover" />
        </div>
        <div className="flex items-center space-x-5 text-[#54656f] dark:text-[#aebac1]">
          <Dialog open={showNewChatDialog} onOpenChange={setShowNewChatDialog}>
            <DialogTrigger asChild>
              <button className="p-1 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full transition-colors">
                <MessageSquare className="w-6 h-6" />
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] dark:bg-[#202c33] dark:text-white border-none">
              <DialogHeader>
                <DialogTitle className="text-xl">New Chat</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <Input
                  placeholder="Contact Name (Optional)"
                  value={newContactName}
                  onChange={(e) => setNewContactName(e.target.value)}
                  className="bg-white dark:bg-[#2a3942] border-none focus-visible:ring-emerald-500"
                />
                <Input
                  placeholder="Phone Number (e.g. 919876543210)"
                  value={newPhoneNumber}
                  onChange={(e) => setNewPhoneNumber(e.target.value)}
                  className="bg-white dark:bg-[#2a3942] border-none focus-visible:ring-emerald-500"
                />
                <Button 
                  onClick={handleCreateNewChat} 
                  className="w-full bg-[#00a884] hover:bg-[#06cf9c] text-white font-semibold rounded-lg h-11"
                >
                  Create Chat
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <button className="p-1 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full transition-colors">
            <MoreVertical className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="p-2 border-b border-gray-100 dark:border-white/5">
        <div className="relative flex items-center bg-[#f0f2f5] dark:bg-[#202c33] rounded-lg px-3 py-1.5 group">
          <Search className="w-5 h-5 text-gray-500 mr-3 group-focus-within:text-[#00a884] transition-colors" />
          <input
            type="text"
            placeholder="Search or start new chat"
            className="flex-1 bg-transparent border-none outline-none text-[15px] text-gray-700 dark:text-[#e9edef] placeholder:text-gray-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Chat List Items */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {filteredChats.map((chat) => (
          <div
            key={chat.id}
            className={`flex items-center px-3 py-3 cursor-pointer transition-colors relative border-b border-gray-50 dark:border-white/5 mx-1 rounded-sm ${
              activeChatId === chat.id 
                ? 'bg-[#f0f2f5] dark:bg-[#2a3942]' 
                : 'hover:bg-[#f5f6f6] dark:hover:bg-[#202c33]'
            }`}
            onClick={() => onSelectChat(chat)}
          >
            <div className="relative flex-shrink-0">
              <img
                src={chat.avatar || `https://i.pravatar.cc/150?u=${chat.phone}`}
                alt={chat.name}
                className="w-12 h-12 rounded-full object-cover"
              />
            </div>
            <div className="ml-3 flex-1 min-w-0 flex flex-col justify-center">
              <div className="flex items-center justify-between">
                <h3 className="truncate text-[17px] font-normal text-[#111b21] dark:text-[#e9edef]">
                  {chat.name}
                </h3>
                <span className={`text-xs ${chat.unread > 0 ? 'text-[#00a884] font-semibold' : 'text-[#667781] dark:text-[#8696a0]'}`}>
                  {formatDate(chat.timestamp)}
                </span>
              </div>
              <div className="flex items-center justify-between mt-0.5">
                <p className="truncate text-[14px] text-[#667781] dark:text-[#8696a0] leading-tight flex-1">
                  {chat.lastMessage}
                </p>
                {chat.unread > 0 && (
                  <span className="flex h-[20px] min-w-[20px] px-1.5 items-center justify-center rounded-full bg-[#00a884] text-[12px] font-bold text-white ml-2">
                    {chat.unread}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: transparent;
        }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb {
          background-color: #374151;
        }
      `}</style>
    </div>
  )
}
