import { queryOne, query } from '../mysql';

export async function getStoredProducts(userId = 'default') {
  try {
    const row = await queryOne(
      'SELECT products FROM products WHERE userId = ? ORDER BY updatedAt DESC LIMIT 1',
      [userId]
    )
    if (!row) {
      // Fallback check for any stored products
      const anyRow = await queryOne('SELECT products FROM products ORDER BY updatedAt DESC LIMIT 1')
      if (!anyRow) return []
      return typeof anyRow.products === 'string' ? JSON.parse(anyRow.products) : (anyRow.products || [])
    }
    return typeof row.products === 'string' ? JSON.parse(row.products) : (row.products || [])
  } catch (e) {
    console.error('getStoredProducts error:', e.message)
    return []
  }
}

export async function saveStoredProducts(arg1, arg2) {
  try {
    const userId = typeof arg1 === 'string' ? arg1 : 'default'
    const products = Array.isArray(arg1) ? arg1 : (Array.isArray(arg2) ? arg2 : [])
    
    if (products.length === 0) return

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
  } catch (e) {
    console.error('saveStoredProducts error:', e.message)
  }
}
