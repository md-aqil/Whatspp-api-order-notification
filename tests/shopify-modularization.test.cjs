const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const rootDir = path.resolve(__dirname, '..')

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8')
}

test('Shopify webhook has a dedicated route and order persistence is isolated', () => {
  const dedicatedRoute = read('app/api/webhook/shopify/route.js')
  const zohoRoute = read('app/api/webhook/zoho/route.js')
  const shopifyWebhook = read('lib/webhooks/shopify.js')
  const orderRepository = read('lib/db/order-repository.js')
  const integrationRepository = read('lib/db/integration-repository.js')
  const catchAllRoute = read('app/api/[[...path]]/route.js')

  assert.match(dedicatedRoute, /handleShopifyWebhook/)
  assert.match(zohoRoute, /handleZohoWebhook/)
  assert.match(shopifyWebhook, /from '..\/db\/order-repository'/)
  assert.match(orderRepository, /export async function insertStoredOrder/)
  assert.match(orderRepository, /export async function getStoredOrderByShopifyOrderId/)
  assert.match(orderRepository, /export async function updateStoredOrderByShopifyOrderId/)
  assert.match(orderRepository, /export async function getStoredOrders/)
  assert.match(orderRepository, /export async function getLatestStoredOrderByPhone/)

  assert.doesNotMatch(integrationRepository, /export async function insertStoredOrder/)
  assert.doesNotMatch(integrationRepository, /export async function getStoredOrderByShopifyOrderId/)
  assert.doesNotMatch(integrationRepository, /export async function updateStoredOrderByShopifyOrderId/)

  assert.doesNotMatch(catchAllRoute, /handleShopifyWebhook/)
  assert.doesNotMatch(catchAllRoute, /handleZohoWebhook/)
  assert.doesNotMatch(catchAllRoute, /ROUTE_HANDLERS/)
  assert.doesNotMatch(catchAllRoute, /async function insertStoredOrder/)
  assert.doesNotMatch(catchAllRoute, /async function getStoredOrderByShopifyOrderId/)
  assert.doesNotMatch(catchAllRoute, /async function updateStoredOrderByShopifyOrderId/)
  assert.doesNotMatch(catchAllRoute, /async function getStoredOrders/)
  assert.doesNotMatch(catchAllRoute, /async function getLatestStoredOrderByPhone/)
})
