import Link from 'next/link'
import { MessageSquare, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function SiteFooter() {
  return (
    <footer className="bg-[#0F172A] border-t border-slate-800 text-slate-300 relative overflow-hidden">
      {/* Decorative gradient */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-px bg-gradient-to-r from-transparent via-emerald-500 to-transparent opacity-50"></div>
      
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-12">
        
        {/* Large CTA before actual footer links */}
        <div className="text-center max-w-3xl mx-auto mb-24">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 tracking-tight">
            Ready to boost your revenue?
          </h2>
          <p className="text-lg text-slate-400 mb-8 font-light">
            Join thousands of modern e-commerce brands using Chatflow to recover carts and delight customers on WhatsApp.
          </p>
          <Link href="/login">
            <Button size="lg" className="h-14 px-8 text-base bg-emerald-500 text-white hover:bg-emerald-400 rounded-full shadow-[0_0_40px_rgba(16,185,129,0.3)] transition-all hover:scale-105 border-none">
              Start your 14-day free trial
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 md:gap-8 border-t border-slate-800/60 pt-16">
          
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-2 mb-6">
              <div className="bg-emerald-500 p-1.5 rounded-lg">
                <MessageSquare className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-extrabold tracking-tight text-white">Chatflow</span>
            </div>
            <p className="text-slate-400 max-w-sm font-light leading-relaxed">
              The ultimate WhatsApp commerce platform for Shopify brands. Automate, support, and sell natively on the world's most popular messaging app.
            </p>
          </div>

          <div>
            <h3 className="text-white font-medium mb-6 tracking-tight">Product</h3>
            <ul className="space-y-4">
              <li><Link href="#features" className="text-sm text-slate-400 hover:text-emerald-400 transition-colors font-light">Features</Link></li>
              <li><Link href="#automations" className="text-sm text-slate-400 hover:text-emerald-400 transition-colors font-light">Automations</Link></li>
              <li><Link href="#integrations" className="text-sm text-slate-400 hover:text-emerald-400 transition-colors font-light">Integrations</Link></li>
              <li><Link href="/login" className="text-sm text-slate-400 hover:text-emerald-400 transition-colors font-light">Sign in</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-white font-medium mb-6 tracking-tight">Legal</h3>
            <ul className="space-y-4">
              <li><Link href="#" className="text-sm text-slate-400 hover:text-emerald-400 transition-colors font-light">Privacy Policy</Link></li>
              <li><Link href="#" className="text-sm text-slate-400 hover:text-emerald-400 transition-colors font-light">Terms of Service</Link></li>
              <li><Link href="#" className="text-sm text-slate-400 hover:text-emerald-400 transition-colors font-light">Cookie Policy</Link></li>
            </ul>
          </div>

        </div>
        
        <div className="mt-16 pt-8 border-t border-slate-800/60 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-slate-500 font-light">
            &copy; {new Date().getFullYear()} Chatflow Inc. All rights reserved.
          </p>
          <div className="text-sm text-slate-500 font-light flex items-center gap-1">
            Designed with <span className="text-emerald-500">♥</span> for e-commerce
          </div>
        </div>
      </div>
    </footer>
  )
}
