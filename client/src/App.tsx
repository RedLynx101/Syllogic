import { Switch, Route, useLocation } from "wouter";
import { queryClient, api, authEvents } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import { useState, useEffect, createContext, useContext } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import Register from "@/pages/auth/register";
import Login from "@/pages/auth/login";
import Dashboard from "@/pages/dashboard";
import Layout from "@/components/layout";

// Create auth context for app-wide authentication state
interface AuthContextType {
  isAuthenticated: boolean;
  user: any | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  user: null,
  loading: true
});

export const useAuth = () => useContext(AuthContext);

// Authentication provider component
function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [, setLocation] = useLocation();

  // Check authentication status on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const userData = await api.auth.me();
        setUser(userData.user);
        setIsAuthenticated(true);
      } catch (error) {
        setUser(null);
        setIsAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();

    // Listen for auth events
    const unsubscribe = authEvents.subscribe((authenticated) => {
      setIsAuthenticated(authenticated);
      if (!authenticated) {
        setUser(null);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

// Error fallback component
function ErrorFallback({ error, resetErrorBoundary }: any) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
      <h2 className="text-2xl font-bold text-red-600 mb-4">
        Something went wrong
      </h2>
      <p className="mb-4 max-w-md text-gray-700">
        {error.message || "An unexpected error occurred"}
      </p>
      <Button onClick={resetErrorBoundary}>Try again</Button>
    </div>
  );
}

// Loading screen
function LoadingScreen() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

// Protected route component
function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      setLocation("/login");
    }
  }, [isAuthenticated, loading, setLocation]);

  if (loading) {
    return <LoadingScreen />;
  }

  return isAuthenticated ? <Component /> : null;
}

// Public route that redirects authenticated users
function AuthRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && isAuthenticated) {
      setLocation("/dashboard");
    }
  }, [isAuthenticated, loading, setLocation]);

  if (loading) {
    return <LoadingScreen />;
  }

  return !isAuthenticated ? <Component /> : null;
}

function Router() {
  return (
    <AuthProvider>
      <Layout>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/login">
            <AuthRoute component={Login} />
          </Route>
          <Route path="/register">
            <AuthRoute component={Register} />
          </Route>
          <Route path="/dashboard">
            <ProtectedRoute component={Dashboard} />
          </Route>
          <Route component={NotFound} />
        </Switch>
      </Layout>
    </AuthProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary FallbackComponent={ErrorFallback}>
        <Router />
        <Toaster />
        <SonnerToaster position="top-right" />
      </ErrorBoundary>
    </QueryClientProvider>
  );
}

export default App;
