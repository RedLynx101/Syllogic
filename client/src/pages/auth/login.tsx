import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from "@/components/ui/card";
import { api, type ApiError } from "@/lib/queryClient";
import { useDocumentTitle } from "@/hooks/use-document-title";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function Login() {
  useDocumentTitle("Log in");
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [, setLocation] = useLocation();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
    mode: "onSubmit",
  });

  const onSubmit = async (data: LoginFormValues) => {
    setLoading(true);
    setSubmitError(null);

    try {
      await api.auth.login(data.email, data.password);
      toast.success("Logged in");
      setLocation("/dashboard");
    } catch (error) {
      const status = (error as ApiError)?.status;
      setSubmitError(
        status === 401
          ? "That email and password do not match an account."
          : status === 0
            ? "The server could not be reached. Check your connection and try again."
            : error instanceof Error && error.message
              ? error.message
              : "Login failed. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="my-8 flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Log in</h1>
          <CardDescription>Log in to save arguments and see the ones you have saved.</CardDescription>
        </CardHeader>

        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
              {submitError && (
                <Alert variant="destructive" className="border-red-300 bg-red-50 text-red-900 [&>svg]:text-red-700">
                  <AlertCircle className="h-4 w-4" aria-hidden="true" />
                  <AlertDescription className="text-red-950">{submitError}</AlertDescription>
                </Alert>
              )}

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        autoComplete="email"
                        placeholder="you@example.com"
                        {...field}
                        disabled={loading}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="current-password" {...field} disabled={loading} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="animate-spin" aria-hidden="true" />}
                {loading ? "Logging in…" : "Log in"}
              </Button>
            </form>
          </Form>
        </CardContent>

        <CardFooter className="justify-center">
          <p className="text-center text-sm text-muted-foreground">
            New to Syllogic?{" "}
            <Link href="/register" className="font-medium text-foreground underline underline-offset-4">
              Create an account
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
