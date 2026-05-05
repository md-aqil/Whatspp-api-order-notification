'use client'

import { useState, useEffect } from 'react'
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts'
import { 
  TrendingUp, 
  MessageSquare, 
  Users, 
  Zap, 
  ArrowUpRight, 
  ArrowDownRight, 
  LayoutDashboard,
  Calendar,
  Sparkles
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function AnalyticsPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/analytics')
      .then(res => res.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  const stats = [
    { name: 'Total Messages', value: data?.summary?.total || 0, icon: MessageSquare, change: '+12.5%', positive: true },
    { name: 'Active Chats', value: data?.summary?.customer || 0, icon: Users, change: '+5.2%', positive: true },
    { name: 'AI Automations', value: data?.automationStats?.[0]?.value || 0, icon: Zap, change: '+18%', positive: true },
    { name: 'Response Rate', value: '94%', icon: TrendingUp, change: '-2%', positive: false },
  ]

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8']

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-xl">
              <LayoutDashboard className="w-8 h-8 text-blue-600" />
            </div>
            Business Analytics
          </h1>
          <p className="mt-2 text-slate-500 dark:text-slate-400 font-medium">
            Real-time insights into your WhatsApp commerce performance.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="rounded-xl border-slate-200 dark:border-white/10 font-bold gap-2">
            <Calendar className="w-4 h-4" />
            Last 30 Days
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20">
            Export Report
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => {
          const Icon = stat.icon
          return (
            <Card key={i} className="border-none shadow-sm dark:bg-[#11131d] rounded-3xl overflow-hidden group">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-slate-50 dark:bg-white/5 rounded-2xl group-hover:scale-110 transition-transform">
                    <Icon className="w-6 h-6 text-slate-600 dark:text-slate-400" />
                  </div>
                  <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${stat.positive ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                    {stat.positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {stat.change}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{stat.name}</p>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">{stat.value}</h3>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Chart */}
        <Card className="lg:col-span-2 border-none shadow-sm dark:bg-[#11131d] rounded-[2.5rem] p-8">
          <CardHeader className="px-0 pt-0">
            <CardTitle className="text-xl font-bold">Message Volume</CardTitle>
            <CardDescription>Daily breakdown of incoming and outgoing messages</CardDescription>
          </CardHeader>
          <div className="h-[350px] w-full mt-6">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.dailyVolume || []}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 12 }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 12 }} 
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="count" 
                  stroke="#2563eb" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorCount)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Sidebar Insights */}
        <div className="space-y-8">
          {/* Top Templates */}
          <Card className="border-none shadow-sm dark:bg-[#11131d] rounded-[2.5rem] p-8">
            <CardHeader className="px-0 pt-0">
              <CardTitle className="text-xl font-bold">Top Templates</CardTitle>
            </CardHeader>
            <div className="space-y-6 mt-6">
              {data?.topTemplates?.map((item, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-bold text-slate-700 dark:text-slate-300 truncate max-w-[150px]">{item.template}</span>
                    <span className="text-slate-500 font-medium">{item.count} used</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-white/5 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-blue-600 h-full rounded-full" 
                      style={{ width: `${(item.count / (data.topTemplates[0].count * 1.2)) * 100}%` }}
                    ></div>
                  </div>
                </div>
              )) || <p className="text-sm text-slate-500">No templates used yet.</p>}
            </div>
          </Card>

          {/* AI Success */}
          <Card className="border-none shadow-sm bg-gradient-to-br from-indigo-600 to-blue-700 rounded-[2.5rem] p-8 text-white relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
            <Sparkles className="w-8 h-8 mb-4 text-blue-200" />
            <h3 className="text-xl font-bold mb-2">AI Performance</h3>
            <p className="text-blue-100/80 text-sm leading-relaxed mb-6">
              Your AI assistant successfully handled 82% of customer queries without human intervention this week.
            </p>
            <div className="flex items-center gap-4">
               <div>
                 <p className="text-2xl font-black">124</p>
                 <p className="text-[10px] font-bold uppercase tracking-widest text-blue-200">Resolutions</p>
               </div>
               <div className="w-px h-8 bg-white/20"></div>
               <div>
                 <p className="text-2xl font-black">4.8s</p>
                 <p className="text-[10px] font-bold uppercase tracking-widest text-blue-200">Avg. Response</p>
               </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
