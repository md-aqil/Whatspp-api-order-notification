'use client'

import { useState, useEffect } from 'react'
import { 
  Users, 
  Settings, 
  Shield, 
  Search, 
  MoreVertical, 
  ExternalLink,
  CheckCircle2,
  XCircle,
  Smartphone,
  Globe,
  Database,
  RefreshCw,
  LayoutGrid,
  List,
  Plus
} from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { format } from 'date-fns'

export default function AdminDashboard() {
  const [users, setUsers] = useState([])
  const [integrations, setIntegrations] = useState({ integrations: [], wordpress: [] })
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('users')
  const [searchQuery, setSearchQuery] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [openDropdownId, setOpenDropdownId] = useState(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState({ name: '', email: '', password: '', role: 'owner', plan: 'pro' })
  const [creating, setCreating] = useState(false)

  const fetchData = async () => {
    setRefreshing(true)
    try {
      const [usersRes, integrationsRes] = await Promise.all([
        fetch('/api/admin/users'),
        fetch('/api/admin/integrations')
      ])
      
      const usersData = await usersRes.json()
      const integrationsData = await integrationsRes.json()
      
      if (usersData.users) setUsers(usersData.users)
      if (integrationsData) setIntegrations(integrationsData)
    } catch (error) {
      console.error('Failed to fetch admin data:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleImpersonate = async (userId) => {
    try {
      const res = await fetch('/api/admin/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      })
      if (res.ok) {
        window.location.href = '/dashboard'
      } else {
        alert('Failed to impersonate user')
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleToggleStatus = async (userId, currentStatus) => {
    try {
      const res = await fetch('/api/admin/users/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, isActive: !currentStatus })
      })
      if (res.ok) {
        fetchData()
      } else {
        alert('Failed to update status')
      }
    } catch (e) {
      console.error(e)
    }
    setOpenDropdownId(null)
  }

  const handleCreateUser = async (e) => {
    e.preventDefault()
    setCreating(true)
    try {
      const res = await fetch('/api/admin/users/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm)
      })
      if (res.ok) {
        setShowCreateModal(false)
        setCreateForm({ name: '', email: '', password: '', role: 'owner', plan: 'pro' })
        fetchData()
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to create user')
      }
    } catch (e) {
      console.error(e)
    } finally {
      setCreating(false)
    }
  }

  const filteredUsers = users.filter(user => 
    user.email.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (user.name && user.name.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const stats = [
    { name: 'Total Users', value: users.length, icon: Users, color: 'text-blue-600', bg: 'bg-blue-100' },
    { name: 'Active Integrations', value: integrations.integrations.length + integrations.wordpress.length, icon: Smartphone, color: 'text-emerald-600', bg: 'bg-emerald-100' },
    { name: 'System Security', value: 'Active', icon: Shield, color: 'text-violet-600', bg: 'bg-violet-100' },
    { name: 'Connected Sites', value: integrations.wordpress.length, icon: Globe, color: 'text-amber-600', bg: 'bg-amber-100' },
  ]

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Superadmin Control Center</h1>
          <p className="text-slate-500 dark:text-slate-400">Monitor all users, connections, and system health.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Create User
          </button>
          <button 
            onClick={fetchData}
            disabled={refreshing}
            className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50 disabled:opacity-50 dark:bg-white/[0.05] dark:text-white dark:ring-white/[0.1] dark:hover:bg-white/[0.1]"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh Data
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <motion.div
            key={stat.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 dark:bg-white/[0.03] dark:ring-white/[0.06]"
          >
            <div className="flex items-center gap-4">
              <div className={`rounded-xl ${stat.bg} p-3 ${stat.color} dark:bg-white/[0.05]`}>
                <stat.icon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{stat.name}</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{stat.value}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-white/[0.03] dark:ring-white/[0.06]">
        {/* Tabs & Search */}
        <div className="flex flex-col border-b border-slate-200 p-4 md:flex-row md:items-center md:justify-between dark:border-white/[0.06]">
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-white/[0.05]">
            <button
              onClick={() => setActiveTab('users')}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
                activeTab === 'users' 
                  ? 'bg-white text-blue-600 shadow-sm dark:bg-white/[0.1] dark:text-white' 
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              Users
            </button>
            <button
              onClick={() => setActiveTab('integrations')}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
                activeTab === 'integrations' 
                  ? 'bg-white text-blue-600 shadow-sm dark:bg-white/[0.1] dark:text-white' 
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              Global Integrations
            </button>
          </div>
          
          <div className="relative mt-4 md:mt-0 md:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search users or emails..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg bg-slate-50 py-2 pl-10 pr-4 text-sm ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-white/[0.05] dark:text-white dark:ring-white/[0.1]"
            />
          </div>
        </div>

        {/* Content */}
        <div className="overflow-x-auto">
          {activeTab === 'users' ? (
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-white/[0.06] dark:bg-white/[0.02] dark:text-slate-400">
                  <th className="px-6 py-4">User</th>
                  <th className="px-6 py-4">Role / Plan</th>
                  <th className="px-6 py-4">Integrations</th>
                  <th className="px-6 py-4">Joined</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-white/[0.06]">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="transition hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-white/[0.05] dark:text-white">
                          {user.name?.[0] || user.email[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">{user.name || 'No Name'}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                          user.role === 'superadmin' ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300' :
                          user.role === 'owner' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                          'bg-slate-100 text-slate-600 dark:bg-white/[0.05] dark:text-white/60'
                        }`}>
                          {user.role}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">{user.plan} plan</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                          <Smartphone className="h-4 w-4" />
                          <span>{user.integrationCount}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                          <Globe className="h-4 w-4" />
                          <span>{user.wordpressCount}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">
                      {format(new Date(user.createdAt), 'MMM d, yyyy')}
                    </td>
                    <td className="px-6 py-4">
                      {user.isActive ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 dark:text-rose-400">
                          <XCircle className="h-3 w-3" />
                          Suspended
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="relative">
                        <button 
                          onClick={() => setOpenDropdownId(openDropdownId === user.id ? null : user.id)}
                          className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/[0.05] dark:hover:text-white"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                        {openDropdownId === user.id && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setOpenDropdownId(null)}></div>
                            <div className="absolute right-0 mt-2 w-48 z-50 rounded-lg border bg-white py-1 shadow-lg dark:bg-[#1a1d29] dark:border-white/[0.08]">
                              <button 
                                onClick={() => handleImpersonate(user.id)}
                                className="block w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/[0.05]"
                              >
                                Login as User
                              </button>
                              <button 
                                onClick={() => handleToggleStatus(user.id, user.isActive)}
                                className={`block w-full px-4 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-white/[0.05] ${user.isActive ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}
                              >
                                {user.isActive ? 'Suspend User' : 'Activate User'}
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-white/[0.06] dark:bg-white/[0.02] dark:text-slate-400">
                  <th className="px-6 py-4">Integration</th>
                  <th className="px-6 py-4">Owner</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4">Created</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-white/[0.06]">
                {integrations.integrations.map((item) => (
                  <tr key={item.id} className="transition hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400">
                          <Smartphone className="h-4 w-4" />
                        </div>
                        <span className="text-sm font-medium text-slate-900 dark:text-white">
                          {item.whatsapp?.phoneNumber || 'WhatsApp Connection'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">{item.userEmail}</td>
                    <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">Native</td>
                    <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">
                      {format(new Date(item.createdAt), 'MMM d, yyyy')}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="h-3 w-3" />
                        Connected
                      </span>
                    </td>
                  </tr>
                ))}
                {integrations.wordpress.map((item) => (
                  <tr key={item.id} className="transition hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-blue-50 p-2 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
                          <Globe className="h-4 w-4" />
                        </div>
                        <span className="text-sm font-medium text-slate-900 dark:text-white">
                          {item.site_name || item.site_url}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">{item.userEmail}</td>
                    <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">WordPress</td>
                    <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">
                      {format(new Date(item.createdAt), 'MMM d, yyyy')}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium ${
                        item.status === 'active' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                      }`}>
                        {item.status === 'active' ? <CheckCircle2 className="h-3 w-3" /> : <RefreshCw className="h-3 w-3 animate-spin" />}
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-[#0b0d14] border border-slate-200 dark:border-white/[0.06]">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Create New User</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-500 dark:hover:text-white">
                <XCircle className="h-6 w-6" />
              </button>
            </div>
            <form onSubmit={handleCreateUser} className="space-y-4 text-left">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Name</label>
                <input required type="text" value={createForm.name} onChange={e => setCreateForm({...createForm, name: e.target.value})} className="mt-1 w-full rounded-lg border p-2 text-sm dark:bg-white/[0.05] dark:border-white/[0.1] dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Email</label>
                <input required type="email" value={createForm.email} onChange={e => setCreateForm({...createForm, email: e.target.value})} className="mt-1 w-full rounded-lg border p-2 text-sm dark:bg-white/[0.05] dark:border-white/[0.1] dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Password</label>
                <input required type="text" value={createForm.password} onChange={e => setCreateForm({...createForm, password: e.target.value})} className="mt-1 w-full rounded-lg border p-2 text-sm dark:bg-white/[0.05] dark:border-white/[0.1] dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Role</label>
                  <select value={createForm.role} onChange={e => setCreateForm({...createForm, role: e.target.value})} className="mt-1 w-full rounded-lg border p-2 text-sm dark:bg-[#1a1d29] dark:border-white/[0.1] dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="owner">Owner</option>
                    <option value="superadmin">Superadmin</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Plan</label>
                  <select value={createForm.plan} onChange={e => setCreateForm({...createForm, plan: e.target.value})} className="mt-1 w-full rounded-lg border p-2 text-sm dark:bg-[#1a1d29] dark:border-white/[0.1] dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="pro">Pro</option>
                    <option value="free">Free</option>
                  </select>
                </div>
              </div>
              <button disabled={creating} type="submit" className="w-full mt-6 rounded-lg bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700 disabled:opacity-50 transition">
                {creating ? 'Creating...' : 'Create User'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
