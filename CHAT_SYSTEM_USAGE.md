# WhatsApp Chat System Usage Guide

## Overview
The WhatsApp Chat System allows administrators to communicate with users directly through an animated chat interface. The system includes sidebar navigation, message bubbles with entrance animations, typing indicators, and interactive elements with tactile feedback.

## Accessing the Chat System

1. Start the development server: `yarn dev`
2. Navigate to the main dashboard: http://localhost:3001
3. Click the "Chat" button in the top right corner
4. Alternatively, go directly to: http://localhost:3001/chat

## Features

### Sidebar Navigation
- Lists all available chats
- Shows user avatars, names, last messages, and timestamps
- Displays unread message counts
- **Hover Animation**: Chat items scale up slightly and show a soft shadow when hovered

### Chat Window
- Displays conversation history with user
- Shows user information at the top of the chat
- **Message Animations**: New messages fade in and slide up when they appear
- **Customer Messages**: Gray bubbles aligned to the left
- **Agent Messages**: Blue bubbles with white text aligned to the right

### Typing Indicator
- Appears when simulating customer typing
- Shows three animated dots bouncing in sequence
- Disappears when the "customer" sends a response

### Message Input
- Text area for typing messages
- Send button with bounce animation
- **Send Button Animation**: Button bounces when clicked for tactile feedback
- Supports Enter key for quick message sending

## Testing Animations

A dedicated test page is available to see all animations in isolation:

1. From the main dashboard, click "Test Animations" in the Motion Primitives banner
2. Alternatively, go directly to: http://localhost:3001/motion-test

This page demonstrates:
- Sidebar chat hover effect
- Message bubble animations
- Typing indicator animation
- Send button bounce effect

## Component Structure

```
ChatPage (/chat)
├── Sidebar
│   └── Chat items with hover animations
└── ChatWindow
    ├── MessageBubble (repeated for each message)
    │   └── Fade + slide animations
    ├── TypingIndicator
    │   └── Animated bouncing dots
    └── Message Input
        └── Send button with bounce animation
```

## Customization

### Animation Timing
- Hover effects: 0.2s
- Message entrance: 0.3s
- Button bounce: 0.2s
- Typing indicator: 0.6s (repeating)

### Styling
- Customer messages: `bg-gray-200 text-gray-800`
- Agent messages: `bg-blue-500 text-white`
- Typing indicator dots: `w-2 h-2 rounded-full bg-gray-400`

## Technical Implementation

### Motion Primitives
All animations are implemented using Motion Primitives:
- `motion.div` for container animations
- `whileHover` for hover effects
- `whileTap` for tap/press effects
- `initial`/`animate` for entrance animations
- `animate` with `transition` for continuous animations

### Performance
- Animations use hardware acceleration
- Efficient component re-rendering
- Minimal DOM updates