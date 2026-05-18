// Run with: node scripts/update-ig-automations.js
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config({ path: '/etc/lcsw/.env' });

// Parse DATABASE_URL: mysql://user:pass@host:port/dbname
const dbUrl = new URL(process.env.DATABASE_URL);
const pool = await mysql.createConnection({
  host: dbUrl.hostname,
  port: Number(dbUrl.port) || 3306,
  user: dbUrl.username,
  password: decodeURIComponent(dbUrl.password),
  database: dbUrl.pathname.replace('/', ''),
});

const commentGrowthSteps = [
  {
    id: 'step-trigger-ig-growth',
    type: 'trigger',
    event: 'instagram.comment_created',
    title: 'Instagram Comment Created',
    position: { x: 120, y: 260 },
    connections: { main: 'step-cond-ig-growth' },
    description: 'Triggered when a customer comments on any post',
    variableMappings: [], customTriggerMode: 'any', customExpectedValue: '',
    customFieldMappings: [], customPreviousValue: '', customWatchedColumn: ''
  },
  {
    id: 'step-cond-ig-growth',
    rule: 'commentText = "price" || commentText = "link" || commentText = "details" || commentText = "coupon"',
    type: 'condition',
    title: 'Check Keywords',
    position: { x: 460, y: 280 },
    connections: { main: 'step-msg-ig-growth-reply', fallback: '' },
    description: 'Filters for high-intent purchasing keywords',
    variableMappings: [], customFieldMappings: []
  },
  {
    id: 'step-msg-ig-growth-reply',
    type: 'message',
    title: 'Comment Reply & DM Delivery',
    channel: 'instagram',
    message: 'Hey @{{username}}! 🌟 Check your DMs — I just sent you your exclusive 15% discount code INSTA15 and the private shop link. 📥✨',
    config: {
      commentReply: 'Hey @{{username}}! 🌟 Check your DMs — I just sent you something special! 📥✨',
      linkUrl: 'https://vaclav.fashion/shop'
    },
    position: { x: 820, y: 260 },
    connections: { main: '' },
    recipientMode: 'customer', recipientNumber: '',
    variableMappings: [], customFieldMappings: []
  }
];

const faqBotSteps = [
  {
    id: 'step-trigger-ig-faq',
    type: 'trigger',
    event: 'instagram.message_received',
    title: 'Instagram DM Received',
    position: { x: 120, y: 340 },
    connections: { main: 'step-inter-ig-faq' },
    description: 'A customer sends a Direct Message to your Instagram Business account',
    variableMappings: [], customTriggerMode: 'any', customExpectedValue: '',
    customFieldMappings: [], customPreviousValue: '', customWatchedColumn: ''
  },
  {
    id: 'step-inter-ig-faq',
    type: 'interactive',
    title: 'Welcome Assistant',
    message: 'Hello @{{username}}! 👋 Welcome to our official support assistant.\n\nHow can we serve you today? Tap one of the buttons below to start:',
    options: [
      { id: 'opt-coupon', label: '🎟️ Get Voucher' },
      { id: 'opt-status', label: '📦 Order Status' },
      { id: 'opt-human', label: '💬 Talk to Agent' }
    ],
    position: { x: 460, y: 340 },
    connections: { 'opt-coupon': 'step-msg-ig-coupon', 'opt-status': 'step-msg-ig-status', 'opt-human': 'step-msg-ig-human' },
    variableMappings: [], customFieldMappings: []
  },
  {
    id: 'step-msg-ig-coupon',
    type: 'message',
    title: 'Voucher Code Reply',
    channel: 'instagram',
    message: 'Here is your exclusive welcome code: WELCOME10 for 10% off! 🎟️✨',
    config: {
      linkUrl: 'https://vaclav.fashion/shop'
    },
    position: { x: 860, y: 160 },
    connections: { main: '' },
    recipientMode: 'customer', recipientNumber: '',
    variableMappings: [], customFieldMappings: []
  },
  {
    id: 'step-msg-ig-status',
    type: 'message',
    title: 'Order Status Prompt',
    channel: 'instagram',
    message: 'I can locate that for you! 📦 Please reply with your Order Number (e.g. #12456) and I will fetch its status instantly.',
    position: { x: 860, y: 340 },
    connections: { main: '' },
    recipientMode: 'customer', recipientNumber: '',
    variableMappings: [], customFieldMappings: []
  },
  {
    id: 'step-msg-ig-human',
    type: 'message',
    title: 'Human Handoff',
    channel: 'instagram',
    message: 'Connecting you with our support specialists... 💬\n\nPlease stay online, a human agent will be with you shortly!',
    position: { x: 860, y: 520 },
    connections: { main: '' },
    recipientMode: 'customer', recipientNumber: '',
    variableMappings: [], customFieldMappings: []
  }
];

await pool.execute(
  'UPDATE automations SET steps = ?, updatedAt = NOW() WHERE id = ?',
  [JSON.stringify(commentGrowthSteps), 'default-instagram-comment-growth']
);
console.log('✅ Updated default-instagram-comment-growth for ALL users');

await pool.execute(
  'UPDATE automations SET steps = ?, updatedAt = NOW() WHERE id = ?',
  [JSON.stringify(faqBotSteps), 'default-instagram-dm-interactive']
);
console.log('✅ Updated default-instagram-dm-interactive for ALL users');

await pool.end();
console.log('Done.');
