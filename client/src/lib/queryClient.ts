import { QueryClient, QueryFunction } from "@tanstack/react-query";

export interface ApiError extends Error {
  status?: number;
  data?: any;
  isAuthError?: boolean;
}

// Event system for handling auth state changes
export const authEvents = {
  listeners: new Set<(isAuthenticated: boolean) => void>(),
  subscribe(listener: (isAuthenticated: boolean) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  },
  notify(isAuthenticated: boolean) {
    this.listeners.forEach(listener => listener(isAuthenticated));
  }
};

async function parseErrorResponse(res: Response): Promise<ApiError> {
  let text = '';
  let data = null;
  
  try {
    // Try to parse as JSON first
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await res.json();
      text = data.error || data.message || res.statusText;
    } else {
      text = await res.text() || res.statusText;
    }
  } catch (e) {
    // If JSON parsing fails, use status text
    text = res.statusText || `Error ${res.status}`;
  }
  
  const error = new Error(text) as ApiError;
  error.status = res.status;
  error.data = data;
  
  // Mark authentication errors
  if (res.status === 401) {
    error.isAuthError = true;
    // Notify auth listeners about unauthenticated state
    authEvents.notify(false);
  }
  
  return error;
}

/**
 * Enhanced API request function with error handling and response parsing
 */
export async function apiRequest<T = any>(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<T> {
  // Ensure URL has the /api prefix
  const apiUrl = url.startsWith('/api') ? url : `/api${url}`;
  
  try {
    const res = await fetch(apiUrl, {
      method,
      headers: {
        ...(data ? { "Content-Type": "application/json" } : {}),
        // Add any custom headers here
      },
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include", // Always include credentials for cookies
    });

    // Handle unsuccessful responses
    if (!res.ok) {
      throw await parseErrorResponse(res);
    }
    
    // Parse successful responses
    if (res.status === 204) {
      return {} as T; // No content
    }
    
    // For 200-level responses, parse JSON
    const result = await res.json();
    return result as T;
  } catch (error) {
    if (error instanceof Error) {
      // If it's already our ApiError type, just rethrow
      if ((error as ApiError).status) {
        throw error;
      }
      
      // Network or other client-side errors
      const apiError = new Error(
        error.message || 'Network error occurred'
      ) as ApiError;
      apiError.status = 0; // Use 0 for network errors
      throw apiError;
    }
    
    // Fallback for unknown errors
    throw new Error('An unknown error occurred');
  }
}

/**
 * Query function factory for React Query
 */
type UnauthorizedBehavior = "returnNull" | "throw";
export function getQueryFn<T>({
  on401: unauthorizedBehavior,
}: {
  on401: UnauthorizedBehavior;
}): QueryFunction<T> {
  return async ({ queryKey }) => {
    try {
      // Extract URL and method from query key
      const endpoint = queryKey[0] as string;
      const method = queryKey.length > 1 ? (queryKey[1] as string) : 'GET';
      
      return await apiRequest<T>(method, endpoint);
    } catch (error) {
      const apiError = error as ApiError;
      
      // Handle 401 based on specified behavior
      if (apiError.status === 401 && unauthorizedBehavior === "returnNull") {
        return null as T;
      }
      
      throw error;
    }
  };
}

/**
 * Utility functions to simplify common API operations
 */
export const api = {
  get: <T>(url: string) => apiRequest<T>('GET', url),
  post: <T>(url: string, data?: any) => apiRequest<T>('POST', url, data),
  put: <T>(url: string, data?: any) => apiRequest<T>('PUT', url, data),
  delete: <T>(url: string) => apiRequest<T>('DELETE', url),
  
  // Auth-specific endpoints
  auth: {
    login: (email: string, password: string) => 
      apiRequest('POST', '/api/auth/login', { email, password })
        .then(() => authEvents.notify(true)),
    
    register: (username: string, email: string, password: string) => 
      apiRequest('POST', '/api/auth/register', { username, email, password })
        .then(() => authEvents.notify(true)),
    
    logout: () => 
      apiRequest('POST', '/api/auth/logout')
        .then(() => authEvents.notify(false)),
    
    me: () => apiRequest('GET', '/api/auth/me'),
    
    // Check if user is authenticated, without throwing errors
    check: async (): Promise<boolean> => {
      try {
        await apiRequest('GET', '/api/auth/me');
        authEvents.notify(true);
        return true;
      } catch (error) {
        authEvents.notify(false);
        return false;
      }
    }
  }
};

// Configure Query Client with better defaults
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: (failureCount, error) => {
        const apiError = error as ApiError;
        // Don't retry auth errors or bad requests
        if (apiError.status === 401 || apiError.status === 400) {
          return false;
        }
        // Only retry network errors a few times
        return failureCount < 2;
      },
    },
    mutations: {
      retry: false,
    },
  },
});
