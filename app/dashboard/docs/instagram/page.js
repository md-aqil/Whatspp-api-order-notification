'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Instagram,
  CheckCircle,
  Zap,
  ArrowLeft,
  Copy,
  Check,
  ExternalLink,
  Lock,
  Workflow,
  ShieldCheck,
  MessageSquare,
  AlertCircle
} from 'lucide-react'

export default function InstagramDocsPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('quickstart')
  const [copiedField, setCopiedField] = useState(null)

  const copyToClipboard = (text, fieldId) => {
    navigator.clipboard.writeText(text)
    setCopiedField(fieldId)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const steps = [
    {
      id: 'quickstart',
      label: '⚡ Quick Start',
      title: 'Get Started with Instagram Automation',
      subtitle: 'Link your accounts in one single click and sync your automations immediately.'
    },
    {
      id: 'prerequisites',
      label: '📋 Prerequisites',
      title: 'Meta Account Pre-requisites',
      subtitle: 'Ensure your accounts are properly configured in Meta prior to integrating.'
    },
    {
      id: 'webhooks',
      label: '🌐 Webhook Setup',
      title: 'Subscribe to Real-time Events',
      subtitle: 'Configure Meta Webhooks to deliver direct messages and comments instantly.'
    },
    {
      id: 'flows',
      label: '🤖 Building Flows',
      title: 'Create Your Automation Logic',
      subtitle: 'Design conversational flows that match comment growth hacks directly to DMs.'
    }
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
      
      {/* Header Navigation */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200/60 dark:border-white/[0.06]">
        <button
          onClick={() => router.push('/dashboard/settings')}
          className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-800 dark:text-white/45 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Settings
        </button>
        <span className="px-2.5 py-1 rounded-full bg-pink-500/10 text-pink-600 dark:text-pink-400 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-pulse"></span>
          Instagram Docs
        </span>
      </div>

      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-[#0e1220] to-[#120f26] border border-slate-800 p-8 md:p-10 shadow-2xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-pink-500/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-violet-600/10 rounded-full blur-3xl -ml-20 -mb-20"></div>

        <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-lg">
            <div className="inline-flex p-3 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-500 text-white shadow-lg shadow-pink-500/20">
              <Instagram className="w-6 h-6" />
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
              Instagram Business Automation Guide
            </h1>
            <p className="text-sm text-slate-400 leading-relaxed">
              Learn how to connect your Instagram account, configure instant comment replies, and deliver personalized DMs to boost engagement and conversions.
            </p>
          </div>

          <Button
            onClick={() => router.push('/dashboard/settings?connect=instagram')}
            className="shrink-0 bg-gradient-to-r from-pink-600 to-violet-600 hover:from-pink-500 hover:to-violet-500 text-white font-black px-6 py-6 shadow-xl shadow-pink-500/10 hover:shadow-pink-500/25 transition-all rounded-2xl flex items-center gap-2"
          >
            <Zap className="w-4.5 h-4.5 text-yellow-300 animate-bounce" />
            Connect Account Now
          </Button>
        </div>
      </div>

      {/* Interactive Docs Panel */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
        
        {/* Navigation Sidebar */}
        <div className="flex md:flex-col gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
          {steps.map((step) => (
            <button
              key={step.id}
              onClick={() => setActiveTab(step.id)}
              className={`flex-1 md:flex-none text-left px-4 py-3 rounded-xl text-xs font-bold transition-all border whitespace-nowrap md:whitespace-normal ${
                activeTab === step.id
                  ? 'bg-slate-900 text-white border-slate-800 dark:bg-white dark:text-slate-900'
                  : 'bg-white dark:bg-slate-950 border-slate-100 dark:border-white/[0.04] text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900/50'
              }`}
            >
              {step.label}
            </button>
          ))}
        </div>

        {/* Content Panel */}
        <div className="md:col-span-3 bg-white dark:bg-[#0f111a] border border-slate-200/60 dark:border-white/[0.06] rounded-2xl p-6 md:p-8 shadow-sm space-y-6 min-h-[400px]">
          
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white mb-1">
              {steps.find(s => s.id === activeTab).title}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {steps.find(s => s.id === activeTab).subtitle}
            </p>
          </div>

          <hr className="border-slate-100 dark:border-white/[0.04]" />

          {/* ACTIVE TAB: QUICKSTART */}
          {activeTab === 'quickstart' && (
            <div className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  Secure One-Click Connection (Recommended)
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Chatflow handles all verification and tokens for you in a secure one-click Facebook authorization workflow.
                </p>
                <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-50/50 to-blue-50/20 dark:from-indigo-950/20 dark:to-blue-950/5 border border-indigo-100 dark:border-indigo-950/50 space-y-4">
                  <div className="flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 text-xs font-bold">1</span>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      Navigate back to the settings page and click the <strong className="text-indigo-600 dark:text-indigo-400">Instagram</strong> integration dialog card.
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 text-xs font-bold">2</span>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      Click the prominent <strong className="text-[#1877F2]">Connect with Facebook</strong> button to log in and authorize Chatflow.
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 text-xs font-bold">3</span>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      Chatflow automatically discovers your linked Instagram accounts, verifies API scopes, and starts triggering flows instantly!
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-pink-100 dark:border-pink-950/30 bg-pink-50/20 dark:bg-pink-950/10 flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-pink-600 dark:text-pink-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-pink-800 dark:text-pink-300">Important Scopes Needed</h4>
                  <p className="text-[11px] text-pink-700 dark:text-pink-400 leading-relaxed">
                    Make sure to accept all permissions during the connection prompt, specifically: <strong>instagram_business_manage_messages</strong> and <strong>instagram_business_manage_comments</strong>.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ACTIVE TAB: PREREQUISITES */}
          {activeTab === 'prerequisites' && (
            <div className="space-y-6">
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Before integrating, Meta requires your Instagram account to be configured with developer API access. Follow this checklist:
              </p>

              <div className="space-y-4">
                {/* Check 1 */}
                <div className="flex gap-3 p-4 rounded-xl border border-slate-100 dark:border-white/[0.04] bg-slate-50/50 dark:bg-slate-900/30">
                  <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Convert to a Business or Creator Account</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      API automation is restricted to professional accounts. Open Instagram ➔ Settings ➔ Account Type and convert your account to **Business** or **Creator**.
                    </p>
                  </div>
                </div>

                {/* Check 2 */}
                <div className="flex gap-3 p-4 rounded-xl border border-slate-100 dark:border-white/[0.04] bg-slate-50/50 dark:bg-slate-900/30">
                  <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Link to your Facebook Business Page</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      Instagram accounts are controlled by Facebook pages. Go to your Instagram Profile ➔ Edit Profile ➔ Page and link your public Facebook Business page.
                    </p>
                  </div>
                </div>

                {/* Check 3 */}
                <div className="flex gap-3 p-4 rounded-xl border border-slate-100 dark:border-white/[0.04] bg-slate-50/50 dark:bg-slate-900/30">
                  <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Allow Access to Messages</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      Meta restricts DM access by default. In your Instagram Mobile App ➔ Settings ➔ Privacy ➔ Messages ➔ Toggle **"Allow Access to Messages"** to **ON**.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ACTIVE TAB: WEBHOOKS */}
          {activeTab === 'webhooks' && (
            <div className="space-y-6">
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                If you are configuring a custom Meta developer app, subscribe your webhook webhook endpoints to the fields below to receive instant comment and DM event triggers:
              </p>

              <div className="space-y-4">
                {/* Field 1: Callback URL */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Callback URL</label>
                  <div className="flex gap-2">
                    <div className="flex-1 font-mono text-xs p-3 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-white/[0.04] rounded-xl text-slate-800 dark:text-slate-200 overflow-x-auto whitespace-nowrap">
                      https://chatflow.vibeship.in/api/webhook/instagram
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => copyToClipboard('https://chatflow.vibeship.in/api/webhook/instagram', 'callbackUrl')}
                      className="shrink-0 p-3 rounded-xl border-slate-100 dark:border-white/[0.04] bg-white dark:bg-slate-950 text-slate-500 hover:text-slate-800 dark:hover:text-white"
                    >
                      {copiedField === 'callbackUrl' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                {/* Field 2: Verify Token */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Verify Token</label>
                  <div className="flex gap-2">
                    <div className="flex-1 font-mono text-xs p-3 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-white/[0.04] rounded-xl text-slate-800 dark:text-slate-200 overflow-x-auto whitespace-nowrap">
                      instagram_verify_token_default
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => copyToClipboard('instagram_verify_token_default', 'verifyToken')}
                      className="shrink-0 p-3 rounded-xl border-slate-100 dark:border-white/[0.04] bg-white dark:bg-slate-950 text-slate-500 hover:text-slate-800 dark:hover:text-white"
                    >
                      {copiedField === 'verifyToken' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                {/* Checklist fields */}
                <div className="space-y-2 pt-2">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Subscribed Fields:</h4>
                  <div className="grid grid-cols-2 gap-3 text-xs text-slate-600 dark:text-slate-300">
                    <div className="flex items-center gap-2 p-3 border border-slate-100 dark:border-white/[0.04] rounded-xl bg-slate-50/50 dark:bg-slate-900/30">
                      <MessageSquare className="w-4 h-4 text-pink-500" />
                      <span><strong>messages</strong> (Incoming DMs)</span>
                    </div>
                    <div className="flex items-center gap-2 p-3 border border-slate-100 dark:border-white/[0.04] rounded-xl bg-slate-50/50 dark:bg-slate-900/30">
                      <Workflow className="w-4 h-4 text-violet-500" />
                      <span><strong>comments</strong> (Post Comments)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ACTIVE TAB: FLOWS */}
          {activeTab === 'flows' && (
            <div className="space-y-6">
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Design multi-stage comment and message flows that run instantly. In the visual Automation Studio, use these variables and structures:
              </p>

              <div className="space-y-4">
                {/* Comment growth hack example */}
                <div className="p-4 rounded-xl border border-slate-100 dark:border-white/[0.04] bg-slate-50/50 dark:bg-slate-900/30 space-y-3">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <span className="flex h-5 w-5 rounded-full bg-violet-100 dark:bg-violet-900/50 text-violet-600 dark:text-violet-400 items-center justify-center text-[10px] font-black">A</span>
                    Comment-to-DM Growth Trigger
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    Set a trigger for **New Comment (Instagram)**. Define trigger keywords (like `"link"`, `"details"`). When a user comments, the engine replies to the comment and automatically slides a direct message containing the custom flow directly to their inbox!
                  </p>
                </div>

                {/* Variable interpolation copy card */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Dynamic Username Interpolation</label>
                  <div className="flex gap-2">
                    <div className="flex-1 font-mono text-xs p-3 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-white/[0.04] rounded-xl text-slate-800 dark:text-slate-200 overflow-x-auto whitespace-nowrap">
                      {"Hi @{{username}}! Thanks for matching. Check details here:"}
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => copyToClipboard('Hi @{{username}}! Thanks for matching. Check details here:', 'dynamicMsg')}
                      className="shrink-0 p-3 rounded-xl border-slate-100 dark:border-white/[0.04] bg-white dark:bg-slate-950 text-slate-500 hover:text-slate-800 dark:hover:text-white"
                    >
                      {copiedField === 'dynamicMsg' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Footer Info */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-500/5 to-pink-500/5 border border-slate-100 dark:border-white/[0.04] flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="space-y-0.5">
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Secure API Integration</h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Authentication is performed securely via official Meta Graph APIs with robust rate limiting.
            </p>
          </div>
        </div>
        
        <Button
          variant="outline"
          onClick={() => window.open('https://developers.facebook.com/docs/instagram-api/', '_blank')}
          className="text-xs font-bold text-slate-600 dark:text-slate-300 border-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900 flex items-center gap-1.5 py-4 px-5 rounded-xl transition-all"
        >
          Meta Graph Docs
          <ExternalLink className="w-3 h-3" />
        </Button>
      </div>

    </div>
  )
}
