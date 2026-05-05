
'use client';

import React, { createContext, useContext, useState } from 'react';

const DemoModeContext = createContext();

export const DemoModeProvider = ({ children }) => {
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [messages, setMessages] = useState([]);
  const [activeAutomation, setActiveAutomation] = useState(null);

  const toggleDemoMode = () => {
    setIsDemoMode(prev => !prev);
  };

  const addMessage = (message) => {
    setMessages(prev => [...prev, message]);
  }

  return (
    <DemoModeContext.Provider value={{ isDemoMode, toggleDemoMode, messages, addMessage, activeAutomation, setActiveAutomation }}>
      {children}
    </DemoModeContext.Provider>
  );
};

export const useDemoMode = () => {
  return useContext(DemoModeContext);
};
