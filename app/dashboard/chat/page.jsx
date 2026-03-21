'use client'

import { useState, useEffect, useRef } from 'react'
import { ChatWindow } from '@/components/dashboard/ChatWindow'
import { ChatList } from '@/components/dashboard/ChatList'
import { Card, CardContent } from '@/components/ui/card'
import { toast, Toaster } from 'sonner'
import { v4 as uuidv4 } from 'uuid'

export default function DashboardChatPage() {
  const [chats, setChats] = useState([])
  const [activeChat, setActiveChat] = useState(null)
  const [loading, setLoading] = useState(true)
  const [messages, setMessages] = useState([])
  const wsRef = useRef(null)
  const pollingIntervalRef = useRef(null)
  const lastMessageCountRef = useRef(0)

  // Load chats from the database
  useEffect(() => {
    const loadChats = async () => {
      try {
        setLoading(true)
        const response = await fetch('/api/chats')
        if (response.ok) {
          const data = await response.json()
          setChats(data)
          if (data.length > 0) {
            setActiveChat(data[0])
          }
        } else {
          throw new Error('Failed to load chats')
        }
      } catch (error) {
        console.error('Failed to load chats:', error)
        // Fallback to mock data if API fails
        const mockChats = [
          {
            id: '1',
            name: 'John Doe',
            phone: '+1234567890',
            lastMessage: 'Thanks for your help!',
            timestamp: new Date(Date.now() - 3600000),
            unread: 0,
            avatar: 'https://ui-avatars.com/api/?name=John+Doe&background=random',
          },
          {
            id: '2',
            name: 'Jane Smith',
            phone: '+1234567891',
            lastMessage: 'Can you send me the catalog?',
            timestamp: new Date(Date.now() - 86400000),
            unread: 2,
            avatar: 'https://ui-avatars.com/api/?name=Jane+Smith&background=random',
          },
          {
            id: '3',
            name: 'Robert Johnson',
            phone: '+1234567892',
            lastMessage: 'I have a question about returns',
            timestamp: new Date(Date.now() - 172800000),
            unread: 0,
            avatar: 'https://ui-avatars.com/api/?name=Robert+Johnson&background=random',
          }
        ]
        setChats(mockChats)
        if (mockChats.length > 0) {
          setActiveChat(mockChats[0])
        }
      } finally {
        setLoading(false)
      }
    }

    loadChats()
  }, [])

  // Load messages for the active chat
  useEffect(() => {
    if (!activeChat) return

    const loadMessages = async () => {
      try {
        const response = await fetch(`/api/chats/${activeChat.phone}/messages`)
        if (response.ok) {
          const data = await response.json()
          setMessages(data)
          lastMessageCountRef.current = data.length
        } else {
          throw new Error('Failed to load messages')
        }
      } catch (error) {
        console.error('Failed to load messages:', error)
        // Fallback to mock data if API fails
        const mockMessages = [
          { 
            id: '1', 
            text: 'Hello! How can I help you today?', 
            isCustomer: true, 
            timestamp: new Date(Date.now() - 3600000),
            phone: activeChat.phone
          },
          { 
            id: '2', 
            text: 'Hi there! I have a question about my order.', 
            isCustomer: false, 
            timestamp: new Date(Date.now() - 3500000),
            phone: activeChat.phone
          },
          { 
            id: '3', 
            text: 'Sure, I\'d be happy to help. What is your order number?', 
            isCustomer: true, 
            timestamp: new Date(Date.now() - 3400000),
            phone: activeChat.phone
          },
        ]
        setMessages(mockMessages)
        lastMessageCountRef.current = mockMessages.length
      }
    }

    loadMessages()
    
    // Set up polling for new messages with optimized interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
    }
    
    pollingIntervalRef.current = setInterval(async () => {
      try {
        const response = await fetch(`/api/chats/${activeChat.phone}/messages`)
        if (response.ok) {
          const data = await response.json()
          // Only update if we have new messages
          if (data.length !== lastMessageCountRef.current) {
            // Check for new incoming messages (from customer)
            const newMessages = data.slice(lastMessageCountRef.current)
            const newIncomingMessages = newMessages.filter(msg => msg.isCustomer === true)
            
            // Show toast notifications for each new incoming message
            newIncomingMessages.forEach(msg => {
              toast(`New message from ${activeChat.name}`, {
                description: msg.text,
                duration: 5000,
                icon: '💬'
              })
            })
            
            setMessages(data)
            lastMessageCountRef.current = data.length
          }
        }
      } catch (error) {
        console.error('Failed to poll messages:', error)
      }
    }, 10000) // Increased polling interval to 10 seconds to reduce server load

    // Clean up polling interval
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
    }
  }, [activeChat])

  const handleSelectChat = (chat) => {
    setActiveChat(chat)
    // Mark messages as read
    setChats(prev => prev.map(c => 
      c.id === chat.id ? { ...c, unread: 0 } : c
    ))
    
    // If this is a new chat that doesn't exist in the database yet, add it to the chats list
    if (!chats.some(c => c.id === chat.id)) {
      setChats(prev => [...prev, chat])
    }
  }

  const handleSendMessage = async (messageText) => {
    if (!activeChat || !messageText.trim()) return

    try {
      // Send the message to WhatsApp API
      const response = await fetch('/api/send-whatsapp-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: activeChat.phone,
          message: messageText
        })
      })
      
      if (!response.ok) {
        let errorMessage = 'Failed to send message'
        try {
          const errorData = await response.json()
          errorMessage = errorData.guidance
            ? `${errorData.error} ${errorData.guidance}`
            : (errorData.error || errorMessage)
        } catch {
          // Keep the fallback message if the response body is not JSON.
        }
        throw new Error(errorMessage)
      }
      
      const result = await response.json()
      console.log(`Message sent to ${activeChat.phone}: ${messageText}`)
      
      // Update the chat list immediately
      setChats(prev => prev.map(chat => 
        chat.id === activeChat.id 
          ? { ...chat, lastMessage: messageText, timestamp: new Date() }
          : chat
      ))
      
      // If the API returned the saved message, add it to the messages list
      if (result.message) {
        setMessages(prev => [...prev, result.message])
        lastMessageCountRef.current = [...messages, result.message].length
      } else {
        // Fallback: refresh all messages to show the newly sent message
        // This will fetch the message with its proper ID from the database
        const messagesResponse = await fetch(`/api/chats/${activeChat.phone}/messages`)
        if (messagesResponse.ok) {
          const data = await messagesResponse.json()
          setMessages(data)
          lastMessageCountRef.current = data.length
        }
      }
      
    } catch (error) {
      console.error('Failed to send message:', error)
      toast.error(error.message || 'Failed to send message. Please try again.')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p>Loading chats...</p>
      </div>
    )
  }

  return (
    <div className="flex h-full -ml-6 -mt-6 border-t border-gray-200 bg-gray-100">
      <Toaster position="bottom-right" />
      {/* Left Panel - Chat List */}
      <div className="w-1/3 border-r flex flex-col h-full bg-white">
        <ChatList 
          chats={chats} 
          activeChatId={activeChat?.id} 
          onSelectChat={handleSelectChat} 
        />
      </div>
      
      {/* Right Panel - Chat Window */}
      <div className="flex-1 flex flex-col h-full">
        {activeChat ? (
          <ChatWindow 
            chat={activeChat} 
            messages={messages} 
            onSendMessage={handleSendMessage} 
          />
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-100">
            <div className="text-center">
              <div className="bg-gray-200 border-2 border-dashed rounded-xl w-16 h-16 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-800 mb-2">WhatsApp Web</h3>
              <p className="text-gray-500 max-w-md">
                Send and receive messages without keeping your phone online.
                Use WhatsApp on up to 4 linked devices and 1 phone at the same time.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
