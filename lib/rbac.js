const permissions = {
  superadmin: [
    'system.access',
    'system.manage',
    'users.manage',
    'users.read',
    'integrations.manage',
    'integrations.read',
    'messages.send',
    'messages.read',
    'campaigns.manage',
    'campaigns.read',
    'automations.manage',
    'automations.read',
    'orders.manage',
    'orders.read',
    'webhooks.manage',
    'webhooks.read',
    'api_keys.manage',
    'api_keys.read',
    'settings.manage',
    'settings.read',
    'analytics.read'
  ],
  owner: [
    'users.manage',
    'users.read',
    'integrations.manage',
    'integrations.read',
    'messages.send',
    'messages.read',
    'campaigns.manage',
    'campaigns.read',
    'automations.manage',
    'automations.read',
    'orders.manage',
    'orders.read',
    'webhooks.manage',
    'webhooks.read',
    'api_keys.manage',
    'api_keys.read',
    'settings.manage',
    'settings.read',
    'analytics.read'
  ],
  admin: [
    'users.manage',
    'users.read',
    'integrations.manage',
    'integrations.read',
    'messages.send',
    'messages.read',
    'campaigns.manage',
    'campaigns.read',
    'automations.manage',
    'automations.read',
    'orders.manage',
    'orders.read',
    'webhooks.manage',
    'webhooks.read',
    'settings.manage',
    'settings.read',
    'analytics.read'
  ],
  member: [
    'integrations.read',
    'messages.send',
    'messages.read',
    'campaigns.manage',
    'campaigns.read',
    'automations.manage',
    'automations.read',
    'orders.read',
    'settings.read'
  ],
  viewer: [
    'integrations.read',
    'messages.read',
    'campaigns.read',
    'automations.read',
    'orders.read'
  ]
};

function hasPermission(role, action) {
  const rolePermissions = permissions[role];
  if (!rolePermissions) {
    return false;
  }
  return rolePermissions.includes(action);
}

function requirePermission(action) {
  return (req, res, next) => {
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!hasPermission(user.role, action)) {
      return res.status(403).json({ error: 'Forbidden: insufficient permissions' });
    }

    next();
  };
}

module.exports = {
  permissions,
  hasPermission,
  requirePermission
};
