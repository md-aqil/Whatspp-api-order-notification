import { v4 as uuidv4 } from 'uuid';

/**
 * Simple metrics collection service for monitoring automation performance
 */
class MetricsService {
  private metrics: Map<string, any> = new Map();
  
  /**
   * Increment a counter metric
   */
  incrementCounter(metricName: string, labels: Record<string, string> = {}): void {
    const key = this.getMetricKey(metricName, labels);
    const current = this.metrics.get(key) || 0;
    this.metrics.set(key, current + 1);
    
    // In production, send to monitoring system (Prometheus, DataDog, etc.)
    console.log(`[METRICS] Counter ${metricName} incremented: ${current + 1}`, { labels });
  }
  
  /**
   * Record a histogram value (for latency measurements)
   */
  recordHistogram(metricName: string, value: number, labels: Record<string, string> = {}): void {
    const key = this.getMetricKey(metricName, labels);
    const histogram = this.metrics.get(key) || { count: 0, sum: 0, buckets: {} };
    
    histogram.count++;
    histogram.sum += value;
    
    // Simple bucket implementation (in production, use proper histogram)
    const bucketLe = Math.ceil(value / 100) * 100; // Bucket every 100ms
    histogram.buckets[bucketLe] = (histogram.buckets[bucketLe] || 0) + 1;
    
    this.metrics.set(key, histogram);
    
    // In production, send to monitoring system
    console.log(`[METRICS] Histogram ${metricName} recorded: ${value}ms`, { labels });
  }
  
  /**
   * Get current metric value
   */
  getMetric(metricName: string, labels: Record<string, string> = {}): any {
    const key = this.getMetricKey(metricName, labels);
    return this.metrics.get(key);
  }
  
  /**
   * Get all metrics
   */
  getAllMetrics(): Map<string, any> {
    return new Map(this.metrics);
  }
  
  /**
   * Generate metric key from name and labels
   */
  private getMetricKey(metricName: string, labels: Record<string, string> = {}): string {
    const labelString = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
    
    return labelString ? `${metricName}{${labelString}}` : metricName;
  }
}

// Export singleton instance
export const metricsService = new MetricsService();