import { NextResponse } from 'next/server'
import { query } from '@/lib/postgres'
import { ensureSettingsTables } from '@/lib/settings-db'

// GET - List all registered webhooks
export async function GET(request) {
    try {
        await ensureSettingsTables()

        const url = new URL(request.url)
        const userId = url.searchParams.get('userId') || 'default'

        const result = await query(
            'SELECT * FROM registered_webhooks WHERE "userId" = $1 ORDER BY "createdAt" DESC',
            [userId]
        )

        return NextResponse.json(result.rows)
    } catch (error) {
        console.error('Error fetching registered webhooks:', error)
        return NextResponse.json([])
    }
}

// POST - Create a new registered webhook
export async function POST(request) {
    try {
        await ensureSettingsTables()

        const body = await request.json()
        const {
            name,
            target_url,
            event_types = [],
            secret_key,
            userId = 'default'
        } = body

        // Validation
        if (!name || !target_url) {
            return NextResponse.json(
                { error: 'Name and target URL are required' },
                { status: 400 }
            )
        }

        // Validate URL format
        try {
            new URL(target_url)
        } catch {
            return NextResponse.json(
                { error: 'Invalid target URL format' },
                { status: 400 }
            )
        }

        const result = await query(
            `INSERT INTO registered_webhooks (name, target_url, event_types, secret_key, "userId") 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING *`,
            [name, target_url, event_types, secret_key || null, userId]
        )

        return NextResponse.json(result.rows[0], { status: 201 })
    } catch (error) {
        console.error('Error creating registered webhook:', error)
        return NextResponse.json({ error: 'Failed to create webhook' }, { status: 500 })
    }
}

// DELETE - Delete a registered webhook
export async function DELETE(request) {
    try {
        await ensureSettingsTables()

        const url = new URL(request.url)
        const id = url.searchParams.get('id')

        if (!id) {
            return NextResponse.json(
                { error: 'Webhook ID is required' },
                { status: 400 }
            )
        }

        await query(
            'DELETE FROM registered_webhooks WHERE id = $1',
            [id]
        )

        return NextResponse.json({ message: 'Webhook deleted successfully' })
    } catch (error) {
        console.error('Error deleting registered webhook:', error)
        return NextResponse.json({ error: 'Failed to delete webhook' }, { status: 500 })
    }
}

// PUT - Update a registered webhook
export async function PUT(request) {
    try {
        await ensureSettingsTables()

        const body = await request.json()
        const { id, name, target_url, event_types, secret_key, is_active } = body

        if (!id) {
            return NextResponse.json(
                { error: 'Webhook ID is required' },
                { status: 400 }
            )
        }

        // Build dynamic update query
        const updates = []
        const values = []
        let paramIndex = 1

        if (name !== undefined) {
            updates.push(`name = $${paramIndex++}`)
            values.push(name)
        }
        if (target_url !== undefined) {
            updates.push(`target_url = $${paramIndex++}`)
            values.push(target_url)
        }
        if (event_types !== undefined) {
            updates.push(`event_types = $${paramIndex++}`)
            values.push(event_types)
        }
        if (secret_key !== undefined) {
            updates.push(`secret_key = $${paramIndex++}`)
            values.push(secret_key)
        }
        if (is_active !== undefined) {
            updates.push(`is_active = $${paramIndex++}`)
            values.push(is_active)
        }

        if (updates.length === 0) {
            return NextResponse.json(
                { error: 'No fields to update' },
                { status: 400 }
            )
        }

        updates.push(`"updatedAt" = NOW()`)
        values.push(id)

        const result = await query(
            `UPDATE registered_webhooks SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
            values
        )

        if (result.rows.length === 0) {
            return NextResponse.json(
                { error: 'Webhook not found' },
                { status: 404 }
            )
        }

        return NextResponse.json(result.rows[0])
    } catch (error) {
        console.error('Error updating registered webhook:', error)
        return NextResponse.json({ error: 'Failed to update webhook' }, { status: 500 })
    }
}
