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
    <div className="flex flex-col h-full bg-white">
      <div className="p-3 border-b flex justify-between items-center bg-gray-50">
        <h2 className="text-lg font-semibold">Chats</h2>
        <Dialog open={showNewChatDialog} onOpenChange={setShowNewChatDialog}>
          <DialogTrigger asChild>
            <Button size="sm" variant="ghost" className="rounded-full p-2" onClick={() => setShowNewChatDialog(true)}>
              <Plus className="w-5 h-5" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Chat</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
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
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
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
            className={`flex items-center p-3 border-b cursor-pointer hover:bg-gray-100 ${
              activeChatId === chat.id ? 'bg-green-50' : ''
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
                <div className="absolute -top-1 -right-1 bg-green-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {chat.unread}
                </div>
              )}
            </div>
            <div className="ml-3 flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-900 truncate">
                  {chat.name}
                </h3>
                <span className="text-xs text-gray-500">
                  {formatDate(chat.timestamp)}
                </span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <p className="text-sm text-gray-500 truncate">
                  {chat.lastMessage}
                </p>
                {chat.unread > 0 && (
                  <span className="bg-green-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
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