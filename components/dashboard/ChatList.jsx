'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Plus, Search, Users, Check, X } from 'lucide-react'

export function ChatList({ 
  chats = [], 
  activeChatId, 
  onSelectChat,
  isMultiSelect = false,
  onToggleMultiSelect,
  selectedChatIds = [],
  onToggleSelectChat,
  onSelectAll,
  onDeselectAll
}) {
  const [showNewChatDialog, setShowNewChatDialog] = useState(false)
  const [newPhoneNumber, setNewPhoneNumber] = useState('')
  const [newContactName, setNewContactName] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  const formatTime = (date) => {
    try {
      return format(new Date(date), 'h:mm a')
    } catch (e) {
      return ''
    }
  }

  const formatDate = (date) => {
    try {
      const today = new Date()
      const messageDate = new Date(date)
      
      if (messageDate.toDateString() === today.toDateString()) {
        return formatTime(date)
      } else if (messageDate > new Date(today.setDate(today.getDate() - 1))) {
        return 'Yesterday'
      } else {
        return format(messageDate, 'dd/MM/yy')
      }
    } catch (e) {
      return ''
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
    (chat.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
    (chat.phone || '').includes(searchQuery)
  )

  const isAllSelected = filteredChats.length > 0 && filteredChats.every(c => selectedChatIds.includes(c.id || c.phone))

  return (
    <div className="flex h-full flex-col bg-white dark:bg-[#0b0d14] border-r border-gray-100 dark:border-slate-800">
      {/* List Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50 dark:border-slate-800 bg-[#f9fafb] dark:bg-[#111827]/50">
        <div>
          <h2 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">Messages</h2>
          <span className="text-[11px] font-medium text-gray-400">
            {chats.length} conversation{chats.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="flex items-center space-x-1.5">
          {/* Multi-Select / Broadcast Toggle */}
          <Button
            variant={isMultiSelect ? "default" : "outline"}
            size="sm"
            onClick={onToggleMultiSelect}
            title={isMultiSelect ? "Exit Broadcast mode" : "Broadcast message to multiple users"}
            className={`h-9 px-2.5 text-xs font-bold rounded-xl transition-all ${
              isMultiSelect 
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20' 
                : 'border-gray-200 dark:border-slate-700 hover:border-emerald-500 hover:text-emerald-600'
            }`}
          >
            <Users className="w-3.5 h-3.5 mr-1.5" />
            <span>{isMultiSelect ? 'Exit' : 'Broadcast'}</span>
          </Button>

          {/* New Chat Dialog */}
          <Dialog open={showNewChatDialog} onOpenChange={setShowNewChatDialog}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10">
                <Plus className="w-4 h-4" />
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

      {/* Broadcast Bulk Action Bar (When in Multi-Select Mode) */}
      {isMultiSelect && (
        <div className="px-5 py-2.5 bg-emerald-50/80 dark:bg-emerald-950/30 border-b border-emerald-100 dark:border-emerald-800/40 flex items-center justify-between animate-in slide-in-from-top-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={isAllSelected ? onDeselectAll : () => onSelectAll(filteredChats)}
              className="text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:underline"
            >
              {isAllSelected ? 'Deselect All' : 'Select All'}
            </button>
            <span className="text-xs text-gray-400">•</span>
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
              {selectedChatIds.length} chosen
            </span>
          </div>

          {selectedChatIds.length > 0 && (
            <button
              type="button"
              onClick={onDeselectAll}
              className="text-[11px] text-red-500 hover:text-red-700 font-medium"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* Search */}
      <div className="p-3 border-b border-gray-50 dark:border-slate-800">
        <div className="relative group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-emerald-500 transition-colors" />
          <Input 
            placeholder="Search conversations..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-10 bg-gray-50 dark:bg-slate-800/50 border-none focus-visible:ring-emerald-500 rounded-xl text-xs placeholder:text-gray-400"
          />
        </div>
      </div>

      {/* Chat Items */}
      <div className="flex-1 overflow-y-auto">
        {filteredChats.map((chat) => {
          const chatIdKey = chat.id || chat.phone
          const isSelected = selectedChatIds.includes(chatIdKey)

          return (
            <div
              key={chatIdKey}
              onClick={() => {
                if (isMultiSelect) {
                  onToggleSelectChat(chat)
                } else {
                  onSelectChat(chat)
                }
              }}
              className={`w-full flex items-center px-4 py-3.5 transition-all duration-150 border-b border-gray-50 dark:border-slate-800/50 cursor-pointer ${
                isMultiSelect
                  ? isSelected
                    ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-l-4 border-l-emerald-500'
                    : 'bg-white dark:bg-transparent hover:bg-gray-50 dark:hover:bg-slate-800/40'
                  : activeChatId === chat.id 
                    ? 'bg-emerald-50/50 dark:bg-emerald-500/10 border-r-4 border-r-emerald-500' 
                    : 'bg-white dark:bg-transparent hover:bg-gray-50 dark:hover:bg-slate-800/50'
              }`}
            >
              {/* Checkbox (Multi-Select Mode) */}
              {isMultiSelect && (
                <div className="mr-3 flex-shrink-0">
                  <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                    isSelected
                      ? 'bg-emerald-500 border-emerald-500 text-white'
                      : 'border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                  }`}>
                    {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                </div>
              )}

              <div className="relative flex-shrink-0">
                <div className="w-11 h-11 md:w-12 md:h-12 rounded-2xl overflow-hidden shadow-sm border border-gray-100 dark:border-slate-700 bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white font-black text-xs md:text-sm uppercase tracking-wider select-none">
                  {chat.avatar && !chat.avatar.includes('pravatar') ? (
                    <img
                      src={chat.avatar}
                      alt={chat.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>
                      {chat.name && !/^\+?\d+$/.test(chat.name.trim())
                        ? chat.name.trim().split(/\s+/).map(n => n[0]).slice(0, 2).join('').toUpperCase()
                        : (chat.phone ? chat.phone.slice(-2) : 'WA')}
                    </span>
                  )}
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white dark:border-[#0b0d14] rounded-full"></div>
              </div>
              
              <div className="ml-3 flex-1 min-w-0 text-left">
                <div className="flex justify-between items-baseline mb-0.5">
                  <h3 className={`font-bold truncate tracking-tight text-sm ${
                    isSelected ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-900 dark:text-white'
                  }`}>
                    {chat.name || chat.phone}
                  </h3>
                  <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 whitespace-nowrap ml-2">
                    {formatDate(chat.timestamp)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <p className={`text-xs truncate ${
                    chat.unread > 0 ? 'text-gray-900 dark:text-white font-bold' : 'text-gray-500 dark:text-gray-400'
                  }`}>
                    {chat.lastMessage || 'No messages yet'}
                  </p>
                  {chat.unread > 0 && !isMultiSelect && (
                    <span className="ml-2 bg-emerald-500 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full shadow-sm shadow-emerald-500/20">
                      {chat.unread}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
