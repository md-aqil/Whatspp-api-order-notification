'use client'

import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { usePathname } from 'next/navigation'

export function NotificationListener() {
  const pathname = usePathname()
  const lastUnreadCountsRef = useRef({})
  const initialLoadRef = useRef(true)

  useEffect(() => {
    const checkNewMessages = async () => {
      try {
        const response = await fetch('/api/chats')
        if (response.ok) {
          const chats = await response.json()
          
          let hasNewMessage = false
          const newCounts = {}

          chats.forEach(chat => {
            const phone = chat.phone
            const unreadCount = chat.unread || 0
            newCounts[phone] = unreadCount

            // If unread count increased since last check
            if (!initialLoadRef.current && unreadCount > (lastUnreadCountsRef.current[phone] || 0)) {
              hasNewMessage = true
              
              // Only show toast if not currently on the chat page
              // Or if we want it everywhere, just show it
              toast(`New message from ${chat.name || phone}`, {
                description: chat.lastMessage,
                icon: '💬',
                onClick: () => {
                   // Optional: Navigate to chat
                   window.location.href = '/dashboard/chat'
                }
              })
            }
          })

          lastUnreadCountsRef.current = newCounts
          initialLoadRef.current = false
        }
      } catch (error) {
        console.error('Failed to poll for notifications:', error)
      }
    }

    // Poll every 5 seconds
    const interval = setInterval(checkNewMessages, 5000)
    
    // Initial check
    checkNewMessages()

    return () => clearInterval(interval)
  }, [pathname])

  return null
}
