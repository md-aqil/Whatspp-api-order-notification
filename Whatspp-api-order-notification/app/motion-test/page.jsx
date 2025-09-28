'use client';

import { motion } from 'motion/react';

export default function MotionTest() {
  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8">Motion Primitives Test</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Sidebar Chat Hover Test */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">Sidebar Chat Hover</h2>
            <motion.div
              whileHover={{ scale: 1.02, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              transition={{ duration: 0.2 }}
              className="p-4 bg-gray-50 rounded-lg cursor-pointer"
            >
              <div className="flex items-center space-x-3">
                <div className="bg-gray-300 rounded-full w-12 h-12 flex items-center justify-center">
                  <span className="font-bold">U</span>
                </div>
                <div>
                  <h3 className="font-semibold">User Name</h3>
                  <p className="text-sm text-gray-500">Last message preview...</p>
                </div>
              </div>
            </motion.div>
            <p className="mt-2 text-sm text-gray-600">Hover over the chat item to see the effect</p>
          </div>
          
          {/* Message Bubble Animation Test */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">Message Bubble Animation</h2>
            <div className="space-y-4">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="flex justify-start"
              >
                <div className="bg-gray-200 text-gray-800 rounded-lg rounded-tl-none px-4 py-2 max-w-xs">
                  <p className="text-sm">Customer message</p>
                </div>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="flex justify-end"
              >
                <div className="bg-blue-500 text-white rounded-lg rounded-tr-none px-4 py-2 max-w-xs">
                  <p className="text-sm">Agent message</p>
                </div>
              </motion.div>
            </div>
            <p className="mt-2 text-sm text-gray-600">Messages fade in and slide up</p>
          </div>
          
          {/* Typing Indicator Test */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">Typing Indicator</h2>
            <div className="flex items-center justify-start">
              <div className="bg-gray-200 rounded-lg rounded-tl-none px-4 py-2">
                <div className="flex space-x-1">
                  {[0, 1, 2].map((index) => (
                    <motion.div
                      key={index}
                      className="w-2 h-2 rounded-full bg-gray-400"
                      animate={{
                        y: [0, -5, 0],
                      }}
                      transition={{
                        duration: 0.6,
                        repeat: Infinity,
                        delay: index * 0.2,
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <p className="mt-2 text-sm text-gray-600">Animated typing dots</p>
          </div>
          
          {/* Send Button Bounce Test */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">Send Button Bounce</h2>
            <div className="flex justify-end">
              <motion.button
                whileTap={{ scale: 0.9 }}
                transition={{ duration: 0.2 }}
                className="bg-blue-500 text-white rounded-full p-3 hover:bg-blue-600"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                </svg>
              </motion.button>
            </div>
            <p className="mt-2 text-sm text-gray-600">Click the button to see the bounce effect</p>
          </div>
        </div>
      </div>
    </div>
  );
}