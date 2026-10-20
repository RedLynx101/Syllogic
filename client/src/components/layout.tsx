import React, { useState } from "react";
import { useAuth } from "@/App";
import { Link, useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Github, LogOut, Menu } from "lucide-react";
import { api } from "@/lib/queryClient";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const REPO_URL = "https://github.com/RedLynx101/Syllogic";

const navLinkClass =
  "rounded-sm px-1 py-0.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 aria-[current=page]:text-foreground aria-[current=page]:underline aria-[current=page]:decoration-2 aria-[current=page]:underline-offset-[6px]";

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  const [location, setLocation] = useLocation();
  const search = useSearch();
  const [menuOpen, setMenuOpen] = useState(false);
  // "/" is the new-argument editor; "/?id=…" shows a saved argument, which is not that page.
  const isCurrent = (href: string) => location === href && (href !== "/" || !new URLSearchParams(search).has("id"));

  const links = [
    { href: "/", label: "Check an argument" },
    ...(isAuthenticated ? [{ href: "/dashboard", label: "My Arguments" }] : []),
  ];

  const handleLogout = async () => {
    setMenuOpen(false);
    try {
      await api.auth.logout();
      toast.success("Logged out");
      setLocation("/");
    } catch {
      toast.error("Could not log out. Please try again.");
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-[60] focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:shadow focus:outline-none focus:ring-2 focus:ring-ring"
      >
        Skip to main content
      </a>

      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="container mx-auto flex h-14 items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-2 md:gap-8">
            {/* Mobile menu */}
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
                  <Menu className="h-5 w-5" aria-hidden="true" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72">
                <SheetHeader className="mb-4 text-left">
                  <SheetTitle>Syllogic</SheetTitle>
                  <SheetDescription>
                    {user ? `Signed in as ${user.username}` : "Categorical syllogism checker"}
                  </SheetDescription>
                </SheetHeader>
                <nav aria-label="Main" className="flex flex-col gap-1">
                  {links.map(({ href, label }) => (
                    <Button key={href} asChild variant="ghost" className="w-full justify-start">
                      <Link
                        href={href}
                        aria-current={isCurrent(href) ? "page" : undefined}
                        onClick={() => setMenuOpen(false)}
                      >
                        {label}
                      </Link>
                    </Button>
                  ))}
                  {isAuthenticated ? (
                    <Button variant="ghost" className="w-full justify-start" onClick={handleLogout}>
                      <LogOut aria-hidden="true" />
                      Log out
                    </Button>
                  ) : (
                    <>
                      <Button asChild variant="ghost" className="w-full justify-start">
                        <Link href="/login" onClick={() => setMenuOpen(false)}>
                          Log in
                        </Link>
                      </Button>
                      <Button asChild variant="ghost" className="w-full justify-start">
                        <Link href="/register" onClick={() => setMenuOpen(false)}>
                          Sign up
                        </Link>
                      </Button>
                    </>
                  )}
                </nav>
              </SheetContent>
            </Sheet>

            <Link
              href="/"
              className="flex items-center gap-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <img src="/favicon.png" alt="" width={28} height={28} className="h-7 w-7" />
              <span className="text-xl font-bold tracking-tight">Syllogic</span>
            </Link>

            <nav aria-label="Main" className="hidden items-center gap-6 md:flex">
              {links.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className={navLinkClass}
                  aria-current={isCurrent(href) ? "page" : undefined}
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <>
                {user && (
                  <span className="hidden text-sm text-muted-foreground sm:inline">
                    Signed in as <span className="font-medium text-foreground">{user.username}</span>
                  </span>
                )}
                <Button variant="ghost" size="sm" onClick={handleLogout}>
                  Log out
                </Button>
              </>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/login">Log in</Link>
                </Button>
                <Button asChild size="sm">
                  <Link href="/register">Sign up</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main id="main" tabIndex={-1} className="container mx-auto flex-1 px-4 py-6 focus:outline-none md:py-8">
        {children}
      </main>

      <footer className="border-t">
        <div className="container mx-auto flex flex-col items-center justify-between gap-2 px-4 py-5 text-sm text-muted-foreground sm:flex-row">
          <p>
            Syllogic is open source under the{" "}
            <a
              href={`${REPO_URL}/blob/main/LICENSE`}
              className={cn("font-medium text-foreground underline-offset-4 hover:underline", "rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring")}
            >
              MIT License
            </a>
            .
          </p>
          <a
            href={REPO_URL}
            className="inline-flex items-center gap-1.5 rounded-sm font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Github className="h-4 w-4" aria-hidden="true" />
            Source on GitHub
          </a>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
