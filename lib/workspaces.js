import { getPool } from './mysql'
import { v4 as uuidv4 } from 'uuid'

/**
 * Get all workspaces a user belongs to
 */
export async function getUserWorkspaces(userId) {
  const pool = getPool()
  if (!pool) return []

  const [rows] = await pool.execute(
    `SELECT w.*, wm.role 
     FROM workspaces w
     JOIN workspace_members wm ON w.id = wm.workspaceId
     WHERE wm.userId = ?`,
    [String(userId)]
  )
  return rows
}

/**
 * Check if a user has a specific role in a workspace
 */
export async function getWorkspaceMember(workspaceId, userId) {
  const pool = getPool()
  if (!pool) return null

  const [rows] = await pool.execute(
    `SELECT * FROM workspace_members 
     WHERE workspaceId = ? AND userId = ?`,
    [workspaceId, String(userId)]
  )
  return rows[0] || null
}

/**
 * Create a new workspace
 */
export async function createWorkspace(name, ownerId) {
  const pool = getPool()
  if (!pool) return null

  const workspaceId = `ws_${uuidv4()}`
  
  await pool.execute(
    `INSERT INTO workspaces (id, name, ownerId) VALUES (?, ?, ?)`,
    [workspaceId, name, String(ownerId)]
  )

  await pool.execute(
    `INSERT INTO workspace_members (workspaceId, userId, role) VALUES (?, ?, ?)`,
    [workspaceId, String(ownerId), 'owner']
  )

  return { id: workspaceId, name, ownerId, role: 'owner' }
}

/**
 * Add a member to a workspace
 */
export async function addWorkspaceMember(workspaceId, userId, role = 'member', invitedBy = null) {
  const pool = getPool()
  if (!pool) return false

  await pool.execute(
    `INSERT INTO workspace_members (workspaceId, userId, role, invitedBy) 
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE role = VALUES(role)`,
    [workspaceId, String(userId), role, invitedBy]
  )
  return true
}
