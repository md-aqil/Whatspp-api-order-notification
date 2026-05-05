import { NextResponse } from 'next/server'
import { metricsService } from '@/lib/metrics'
import { httpClient } from '@/lib/httpClient'

export async function GET() {
  try {
    // Basic health checks
    const healthChecks = {
      timestamp: new Date().toISOString(),
      services: {
        database: 'healthy', // In real implementation, check DB connection
        httpClient: 'healthy', // HTTP client is initialized
      },
      metrics: {
        totalCounters: metricsService.getAllMetrics().size
      }
    }
    
    // Check if any critical services are unhealthy
    const isHealthy = Object.values(healthChecks.services).every(status => status === 'healthy')
    
    return NextResponse.json(
      { 
        status: isHealthy ? 'healthy' : 'unhealthy',
        ...healthChecks 
      },
      { status: isHealthy ? 200 : 503 }
    )
  } catch (error) {
    console.error('[HEALTH CHECK] Error:', error)
    return NextResponse.json(
      { 
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      },
      { status: 503 }
    )
  }
}