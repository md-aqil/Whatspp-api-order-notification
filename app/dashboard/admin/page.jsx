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
  List
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
        <button 
          onClick={fetchData}
          disabled={refreshing}
          className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50 disabled:opacity-50 dark:bg-white/[0.05] dark:text-white dark:ring-white/[0.1] dark:hover:bg-white/[0.1]"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh Data
        </button>
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
                      <button className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/[0.05] dark:hover:text-white">
                        <ExternalLink className="h-4 w-4" />
                      </button>
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
    </div>
  )
}
