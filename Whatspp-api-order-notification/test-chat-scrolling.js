// Test script to verify natural scrolling behavior in chat components
// This script can be run in the browser console to simulate chat interactions

console.log('Chat scrolling behavior test initialized');

// Function to simulate adding messages to chat
function addMessage(isCustomer = true) {
  const messagesContainer = document.querySelector('.overflow-y-auto.p-4');
  if (!messagesContainer) {
    console.log('Messages container not found');
    return;
  }

  // Create a new message element
  const messageDiv = document.createElement('div');
  messageDiv.className = `flex mb-4 ${isCustomer ? 'justify-start' : 'justify-end'}`;
  
  const messageContent = document.createElement('div');
  messageContent.className = `max-w-xs md:max-w-md px-4 py-2 rounded-lg ${
    isCustomer 
      ? 'bg-gray-200 text-gray-800 rounded-tl-none' 
      : 'bg-blue-500 text-white rounded-tr-none'
  }`;
  messageContent.innerHTML = `<p class="text-sm">Test message ${Date.now()}</p>`;
  
  messageDiv.appendChild(messageContent);
  messagesContainer.appendChild(messageDiv);
  
  console.log(`Added ${isCustomer ? 'customer' : 'agent'} message`);
}

// Function to test scrolling behavior
function testScrolling() {
  const messagesContainer = document.querySelector('.overflow-y-auto.p-4');
  if (!messagesContainer) {
    console.log('Messages container not found');
    return;
  }

  console.log('Testing scrolling behavior...');
  
  // Scroll to top first
  messagesContainer.scrollTop = 0;
  console.log('Scrolled to top');
  
  // Add a few messages to see if it forces scroll down
  setTimeout(() => {
    addMessage(true);
    console.log('Check if it scrolled down (it should NOT when viewing history)');
  }, 1000);
  
  setTimeout(() => {
    addMessage(false);
  }, 2000);
  
  setTimeout(() => {
    addMessage(true);
  }, 3000);
  
  // Now scroll to bottom and add message to see auto-scroll
  setTimeout(() => {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    console.log('Scrolled to bottom');
  }, 4000);
  
  setTimeout(() => {
    addMessage(false);
    console.log('Check if it scrolled down (it SHOULD when at bottom)');
  }, 5000);
}

// Run the test
console.log('To test scrolling behavior:');
console.log('1. Open the chat page in browser');
console.log('2. Scroll up to view chat history');
console.log('3. Run testScrolling() in browser console');
console.log('4. Observe that new messages do not force scroll when viewing history');
console.log('5. When scrolled to bottom, new messages should auto-scroll');

// Export for manual testing
window.testScrolling = testScrolling;
window.addMessage = addMessage;