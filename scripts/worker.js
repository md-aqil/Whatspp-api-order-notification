const { Worker } = require('bullmq');
const IORedis = require('ioredis');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Since we are running in a separate process, we might need to handle imports carefully if using ES modules
// For now, I'll assume we can use dynamic import or just standard require if the files are compatible.
// To be safe in a Next.js environment, we might need a small wrapper.

async function startWorker() {
  console.log('--- Automation Worker Starting ---');
  
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const connection = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
  });

  // Import the engine (using dynamic import for ESM compatibility in Next.js projects)
  const engineModule = await import('../lib/automation-engine.js');
  const processAutomationEvent = engineModule.processAutomationEvent 
    || engineModule.default?.processAutomationEvent;
  
  if (typeof processAutomationEvent !== 'function') {
    throw new Error('Failed to load processAutomationEvent from automation-engine. Exports: ' + Object.keys(engineModule).join(', '));
  }

  const worker = new Worker('automation-events', async job => {
    console.log(`[Worker] Processing job ${job.id} (${job.name})`);
    try {
      await processAutomationEvent(job.data);
      console.log(`[Worker] Successfully processed job ${job.id}`);
    } catch (error) {
      console.error(`[Worker] Error processing job ${job.id}:`, error);
      throw error; // Let BullMQ handle retries
    }
  }, { 
    connection,
    concurrency: 5, // Process 5 events in parallel
  });

  worker.on('completed', job => {
    // console.log(`Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed with error: ${err.message}`);
  });

  console.log('Worker is listening for jobs on "automation-events" queue...');
}

startWorker().catch(err => {
  console.error('Fatal Worker Error:', err);
  process.exit(1);
});
