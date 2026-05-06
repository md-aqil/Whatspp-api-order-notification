import { queryOne, query } from '../mysql';

export async function getStoredProducts(userId = 'default') {
  const row = await queryOne(
    'SELECT products FROM products WHERE userId = ? ORDER BY updatedAt DESC LIMIT 1',
    [userId]
  )
  if (!row) return []
  try {
    return typeof row.products === 'string' ? JSON.parse(row.products) : row.products
  } catch (e) {
    return []
  }
}

export async function saveStoredProducts(userId, products) {
  // Check if row exists since we might not have a unique constraint yet
  const existing = await queryOne('SELECT id FROM products WHERE userId = ?', [userId])
  
  if (existing) {
    await query(
      'UPDATE products SET products = ?, updatedAt = NOW() WHERE id = ?',
      [JSON.stringify(products), existing.id]
    )
  } else {
    await query(
      'INSERT INTO products (userId, products, updatedAt) VALUES (?, ?, NOW())',
      [userId, JSON.stringify(products)]
    )
  }
}
