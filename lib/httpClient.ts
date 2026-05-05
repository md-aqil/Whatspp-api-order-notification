import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { v4 as uuidv4 } from 'uuid';

interface CircuitBreakerState {
  failureCount: number;
  lastFailureTime: number;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  timeout: number;
}

/**
 * Centralized HTTP client for all external API calls
 * Implements timeout, retry logic, error logging, request tracing, and circuit breaker pattern
 */
class HttpClient {
  private instance: AxiosInstance;
  private maxRetries: number = 3;
  private timeout: number = 10000; // 10 seconds
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  private readonly circuitBreakerThreshold = 5; // Failures before opening circuit
  private readonly circuitBreakerTimeout = 60000; // 60 seconds before trying half-open

  constructor() {
    this.instance = axios.create({
      timeout: this.timeout,
    });

    // Request interceptor for adding request ID and logging
    this.instance.interceptors.request.use(
      (config) => {
        const requestId = uuidv4();
        config.headers = {
          ...config.headers,
          'X-Request-ID': requestId,
        };

        // Log request (in production, use proper logger)
        console.log(`[HTTP REQUEST] ${config.method?.toUpperCase()} ${config.url} - RequestID: ${requestId}`);
        
        return config;
      },
      (error) => {
        console.error('[HTTP REQUEST ERROR]', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor for logging and error handling
    this.instance.interceptors.response.use(
      (response) => {
        const requestId = response.headers?.['x-request-id'] || 'unknown';
        console.log(`[HTTP RESPONSE] ${response.status} ${response.config?.method?.toUpperCase()} ${response.config?.url} - RequestID: ${requestId}`);
        
        // Reset circuit breaker on success
        const serviceKey = this.getServiceKey(response.config);
        this.onRequestSuccess(serviceKey);
        
        return response;
      },
      (error) => {
        const requestId = error.response?.headers?.['x-request-id'] || 
                         error.config?.headers?.['X-Request-ID'] || 
                         'unknown';
        
        console.error(`[HTTP ERROR] RequestID: ${requestId}`, {
          message: error.message,
          code: error.code,
          status: error.response?.status,
          url: error.config?.url,
          method: error.config?.method
        });
        
        // Update circuit breaker on failure
        if (error.config) {
          const serviceKey = this.getServiceKey(error.config);
          this.onRequestFailure(serviceKey, error);
        }
        
        return Promise.reject(error);
      }
    );
  }

  /**
   * Generate a service key for circuit breaker tracking
   */
  private getServiceKey(config: AxiosRequestConfig): string {
    return `${config.method?.toUpperCase()}:${config.url}`;
  }

  /**
   * Handle successful request for circuit breaker
   */
  private onRequestSuccess(serviceKey: string): void {
    const breaker = this.circuitBreakers.get(serviceKey);
    if (breaker) {
      breaker.failureCount = 0;
      if (breaker.state === 'HALF_OPEN') {
        breaker.state = 'CLOSED';
        console.log(`[CIRCUIT BREAKER] Service ${serviceKey} is now CLOSED`);
      }
    }
  }

  /**
   * Handle failed request for circuit breaker
   */
  private onRequestFailure(serviceKey: string, error: any): void {
    const breaker = this.circuitBreakers.get(serviceKey) || {
      failureCount: 0,
      lastFailureTime: 0,
      state: 'CLOSED',
      timeout: this.circuitBreakerTimeout
    };

    breaker.failureCount++;
    breaker.lastFailureTime = Date.now();

    if (breaker.failureCount >= this.circuitBreakerThreshold && breaker.state === 'CLOSED') {
      breaker.state = 'OPEN';
      console.log(`[CIRCUIT BREAKER] Service ${serviceKey} is now OPEN after ${breaker.failureCount} failures`);
    }

    this.circuitBreakers.set(serviceKey, breaker);
  }

  /**
   * Check if service is available according to circuit breaker
   */
  private isServiceAvailable(serviceKey: string): boolean {
    const breaker = this.circuitBreakers.get(serviceKey);
    if (!breaker) return true;

    if (breaker.state === 'CLOSED') return true;
    
    if (breaker.state === 'OPEN') {
      if (Date.now() - breaker.lastFailureTime > breaker.timeout) {
        breaker.state = 'HALF_OPEN';
        console.log(`[CIRCUIT BREAKER] Service ${serviceKey} is now HALF_OPEN`);
        this.circuitBreakers.set(serviceKey, breaker);
        return true;
      }
      return false;
    }

    // HALF_OPEN state - allow one request through
    return true;
  }

  /**
   * Make HTTP request with retry logic and circuit breaker
   * @param config Axios request configuration
   * @returns Promise<AxiosResponse>
   */
  async request<T = any>(config: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    const serviceKey = this.getServiceKey(config);
    
    // Check circuit breaker
    if (!this.isServiceAvailable(serviceKey)) {
      throw new Error(`Circuit breaker OPEN for service ${serviceKey}`);
    }

    let lastError: AxiosError | null = null;
    
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await this.instance.request<T>(config);
      } catch (error) {
        lastError = error as AxiosError;
        
        // If this is the last attempt, don't retry
        if (attempt === this.maxRetries) {
          break;
        }
        
        // Don't retry on client errors (4xx) except 429 (rate limit)
        if (error.response && 
            error.response.status >= 400 && 
            error.response.status < 500 && 
            error.response.status !== 429) {
          break;
        }
        
        // Wait before retrying (exponential backoff with jitter)
        const delay = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 1000, 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  }

  // Convenience methods for common HTTP verbs
  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.request<T>({ ...config, method: 'GET', url });
  }

  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.request<T>({ ...config, method: 'POST', url, data });
  }

  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.request<T>({ ...config, method: 'PUT', url, data });
  }

  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.request<T>({ ...config, method: 'DELETE', url });
  }

  async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.request<T>({ ...config, method: 'PATCH', url, data });
  }
}

// Export singleton instance
export const httpClient = new HttpClient();

// Export type for convenience
export type { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError };