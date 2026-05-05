const IORedis = require('ioredis');
const { Queue } = require('bullmq');

async function testEnqueue() {
  const connection = new IORedis('redis://localhost:6379');
  const automationQueue = new Queue('automation-events', { connection });

  console.log('--- Simulating WhatsApp Webhook ---');
  
  const testJob = {
    event: 'whatsapp.message_received',
    context: {
      from: '1234567890',
      customer_name: 'John Doe',
      customer_message: 'hello',
      type: 'text'
    },
    userId: '1'
  };

  await automationQueue.add('test_whatsapp_reply', testJob);
  console.log('Enqueued test event to Redis. Make sure your worker is running!');
  
  await connection.quit();
}

testEnqueue().catch(console.error);
