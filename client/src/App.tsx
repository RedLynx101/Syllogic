import { Switch, Route, useLocation, useSearch } from "wouter";
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

interface AuthUser {
  id: number;
  username: string;
  email: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: AuthUser | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  user: null,
  loading: true
});

export const useAuth = () => useContext(AuthContext);

function LoadingScreen() {
  return (
    <div className="flex items-center justify-center h-[60vh]" role="status">
      <Loader2 className="animate-spin" aria-hidden="true" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}

function ErrorFallback({ resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
  return (
    <div className="container py-8 text-center" role="alert">
      <h1 className="text-2xl font-bold mb-4">Something went wrong</h1>
      <Button onClick={resetErrorBoundary} variant="outline">
        Try again
      </Button>
    </div>
  );
}

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let active = true;
    // Tracks the last known state so caches are only cleared on a real sign-out,
    // not on every 401 an anonymous visitor receives.
    let signedIn = false;

    const loadUser = async () => {
      try {
        const userData = await api.get<{ user: AuthUser }>("/api/auth/me");
        if (!active) return;
        signedIn = true;
        setUser(userData.user);
        setIsAuthenticated(true);
      } catch {
        // A 401 here also reaches the subscriber below, which resets the state.
        if (!active) return;
        setUser(null);
        setIsAuthenticated(false);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadUser();

    const unsubscribe = authEvents.subscribe((authenticated) => {
      if (authenticated) {
        setIsAuthenticated(true);
        if (!signedIn) {
          signedIn = true;
          loadUser();
          queryClient.invalidateQueries();
        }
      } else {
        setIsAuthenticated(false);
        setUser(null);
        if (signedIn) {
          signedIn = false;
          // Drop cached saved arguments so the next account on this browser never sees them
          queryClient.removeQueries({ queryKey: ["/api/user/arguments"] });
          queryClient.removeQueries({
            predicate: (query) => String(query.queryKey[0] ?? "").startsWith("/api/arguments"),
          });
        }
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

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

/** Remounts the editor whenever the argument id changes, so no state leaks between arguments. */
function HomeRoute() {
  const id = new URLSearchParams(useSearch()).get("id");
  return <Home key={id ?? "new"} />;
}

function Router() {
  return (
    <AuthProvider>
      <Layout>
        <Switch>
          <Route path="/" component={HomeRoute} />
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
        <SonnerToaster position="bottom-right" closeButton />
      </ErrorBoundary>
    </QueryClientProvider>
  );
}

export default App;
