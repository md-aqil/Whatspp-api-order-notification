'use client'

import { useState, useEffect } from 'react'
import { Brain, Plus, Trash2, Save, Search, Sparkles, MessageSquare, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { toast } from 'sonner'

export default function KnowledgeBasePage() {
  const [knowledge, setKnowledge] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    fetchKnowledge()
  }, [])

  const fetchKnowledge = async () => {
    try {
      const res = await fetch('/api/knowledge-base')
      if (res.ok) {
        const data = await res.json()
        setKnowledge(data)
      }
    } catch (error) {
      console.error('Failed to fetch knowledge:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddKnowledge = async () => {
    if (!newContent.trim()) {
      toast.error('Please provide some content')
      return
    }

    setIsSaving(true)
    try {
      const res = await fetch('/api/knowledge-base', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle, content: newContent })
      })

      if (res.ok) {
        toast.success('Knowledge added successfully')
        setNewTitle('')
        setNewContent('')
        setShowAddDialog(false)
        fetchKnowledge()
      } else {
        toast.error('Failed to add knowledge')
      }
    } catch (error) {
      toast.error('An error occurred')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this knowledge?')) return

    try {
      const res = await fetch('/api/knowledge-base', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      })

      if (res.ok) {
        toast.success('Deleted successfully')
        fetchKnowledge()
      }
    } catch (error) {
      toast.error('Failed to delete')
    }
  }

  const filteredKnowledge = knowledge.filter(k => 
    k.title?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    k.content?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-xl">
              <Brain className="w-8 h-8 text-emerald-600" />
            </div>
            AI Knowledge Base
          </h1>
          <p className="mt-2 text-slate-500 dark:text-slate-400 font-medium">
            Teach your AI assistant everything about your business.
          </p>
        </div>
        
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-12 px-6 rounded-xl shadow-lg shadow-emerald-500/20 gap-2">
              <Plus className="w-5 h-5" />
              Add Knowledge
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] dark:bg-[#11131d] border-none shadow-2xl rounded-3xl">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold tracking-tight">Add Business Knowledge</DialogTitle>
            </DialogHeader>
            <div className="space-y-6 py-6">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-1">Title / Source</label>
                <Input
                  placeholder="e.g. Pricing List, Return Policy"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="h-12 bg-slate-50 dark:bg-white/5 border-none rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-400 ml-1">Content</label>
                <Textarea
                  placeholder="Paste details about your products, services, or FAQs here..."
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  className="min-h-[250px] bg-slate-50 dark:bg-white/5 border-none rounded-xl resize-none p-4"
                />
              </div>
              <Button 
                onClick={handleAddKnowledge} 
                disabled={isSaving}
                className="w-full bg-emerald-600 hover:bg-emerald-700 h-12 rounded-xl font-bold text-white shadow-lg"
              >
                {isSaving ? 'Saving...' : 'Save Knowledge'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
            <input
              type="text"
              placeholder="Search your knowledge base..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-14 pl-12 pr-4 bg-white dark:bg-[#11131d] border border-slate-200/60 dark:border-white/5 rounded-2xl shadow-sm focus:outline-none focus:ring-2 ring-emerald-500/20 transition-all text-slate-700 dark:text-white"
            />
          </div>

          <div className="space-y-4">
            {loading ? (
              <div className="p-12 text-center bg-white dark:bg-[#11131d] rounded-3xl border border-dashed border-slate-200 dark:border-white/10">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mx-auto"></div>
                <p className="mt-4 text-slate-500">Loading your knowledge...</p>
              </div>
            ) : filteredKnowledge.length === 0 ? (
              <div className="p-16 text-center bg-white dark:bg-[#11131d] rounded-3xl border border-dashed border-slate-200 dark:border-white/10">
                <div className="w-20 h-20 bg-slate-50 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Info className="w-10 h-10 text-slate-300" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">No knowledge found</h3>
                <p className="text-slate-500 max-w-xs mx-auto">Start by adding information about your products or business rules.</p>
              </div>
            ) : (
              filteredKnowledge.map((item) => (
                <div 
                  key={item.id} 
                  className="group bg-white dark:bg-[#11131d] p-6 rounded-3xl border border-slate-200/60 dark:border-white/5 hover:shadow-xl hover:shadow-slate-200/40 dark:hover:shadow-none transition-all duration-300"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl flex items-center justify-center">
                        <Sparkles className="w-5 h-5 text-emerald-600" />
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">{item.title}</h3>
                    </div>
                    <button 
                      onClick={() => handleDelete(item.id)}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="bg-slate-50/50 dark:bg-white/5 p-4 rounded-2xl">
                    <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed whitespace-pre-wrap line-clamp-6">
                      {item.content}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-emerald-600 to-teal-700 p-8 rounded-[2.5rem] text-white shadow-2xl shadow-emerald-500/20 relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
            <Sparkles className="w-10 h-10 mb-6 text-emerald-200" />
            <h3 className="text-2xl font-black mb-3">How it works</h3>
            <p className="text-emerald-50/80 leading-relaxed mb-6 text-sm">
              The AI uses this data to answer customer queries on WhatsApp. The more detailed your information, the better the AI performs.
            </p>
            <ul className="space-y-3 text-sm font-medium">
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-300"></div>
                Add Product Specs
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-300"></div>
                Input Shipping Times
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-300"></div>
                Describe Return Policies
              </li>
            </ul>
          </div>

          <div className="bg-white dark:bg-[#11131d] p-8 rounded-[2.5rem] border border-slate-200/60 dark:border-white/5">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-emerald-500" />
              Pro Tips
            </h3>
            <div className="space-y-6">
              <div className="space-y-2">
                <p className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider">Be Specific</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  Instead of "Fast shipping," use "Ships in 2-3 business days."
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider">Tone of Voice</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  The AI mimics a professional yet friendly human assistant.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
