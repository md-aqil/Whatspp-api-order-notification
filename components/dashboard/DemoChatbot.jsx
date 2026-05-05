
'use client';

import { useDemoMode } from '@/contexts/DemoModeContext';
import '/app/demo-chatbot.css';
import { useState, useRef, useEffect } from 'react';

export function DemoChatbot({ activeAutomation }) {
  const { isDemoMode, messages, addMessage } = useDemoMode();
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
  };

  const handleSendMessage = () => {
    if (inputValue.trim() === '') return;

    addMessage({ sender: 'user', text: inputValue });
    setInputValue('');

    if (activeAutomation) {
      const trigger = activeAutomation.steps.find(step => step.event === 'whatsapp.message_received');
      if (trigger) {
        let currentStep = trigger;
        const flow = [];
        while (currentStep) {
          flow.push(currentStep);
          const nextStepId = currentStep.connections?.main;
          currentStep = activeAutomation.steps.find(step => step.id === nextStepId);
        }

        flow.forEach((step, index) => {
          if (index > 0) { // skip the trigger
            setTimeout(() => {
              if (step.type === 'message') {
                addMessage({ sender: 'bot', text: step.message });
              } else if (step.type === 'interactive') {
                const options = step.options.map(opt => opt.label).join('\n');
                addMessage({ sender: 'bot', text: `${step.message}\n${options}` });
              } else if (step.type === 'ai_reply') {
                addMessage({ sender: 'bot', text: 'This is a simulated AI response.' });
              }
            }, 1000 * index);
          }
        });
      } else {
        setTimeout(() => {
          addMessage({ sender: 'bot', text: 'No auto-reply configured for this demo.' });
        }, 1000);
      }
    } else {
      // Simulate bot response
      setTimeout(() => {
        addMessage({ sender: 'bot', text: 'This is a simulated response.' });
      }, 1000);
    }
  };

  if (!isDemoMode) {
    return null;
  }

  return (
    <div className="demo-chatbot-container">
      <div className="demo-chatbot-header">
        <img src="/images/whatsapp-profile.png" alt="WhatsApp Profile" className="demo-chatbot-profile-pic" />
        <div className="demo-chatbot-contact-info">
          <div className="demo-chatbot-contact-name">Support</div>
          <div className="demo-chatbot-contact-status">online</div>
        </div>
      </div>
      <div className="demo-chatbot-messages">
        {messages.map((msg, index) => (
          <div key={index} className={`demo-chatbot-message ${msg.sender}`}>
            {msg.text}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div className="demo-chatbot-input-area">
        <input 
          type="text" 
          placeholder="Type a message..." 
          className="demo-chatbot-input" 
          value={inputValue} 
          onChange={handleInputChange} 
          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
        />
        <button onClick={handleSendMessage} className="demo-chatbot-send-button">Send</button>
      </div>
    </div>
  );
}

