'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function SendCatalogRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/dashboard/campaigns?mode=catalog')
  }, [router])

  return (
    <div className="flex items-center justify-center h-full min-h-[400px]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  )
}
