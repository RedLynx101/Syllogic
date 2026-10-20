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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from "@/components/ui/card";
import { api, type ApiError } from "@/lib/queryClient";
import { useDocumentTitle } from "@/hooks/use-document-title";

const registerSchema = z
  .object({
    username: z
      .string()
      .min(3, "Use at least 3 characters")
      .max(30, "Use at most 30 characters")
      .regex(/^[a-zA-Z0-9_]+$/, "Use letters, numbers and underscores only"),
    email: z.string().email("Enter a valid email address"),
    password: z
      .string()
      .min(8, "Use at least 8 characters")
      .regex(/[a-z]/, "Include a lowercase letter")
      .regex(/[A-Z]/, "Include an uppercase letter")
      .regex(/[0-9]/, "Include a number"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "The passwords do not match",
    path: ["confirmPassword"],
  });

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function Register() {
  useDocumentTitle("Create an account");
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [, setLocation] = useLocation();

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { username: "", email: "", password: "", confirmPassword: "" },
    mode: "onBlur",
  });

  const onSubmit = async (data: RegisterFormValues) => {
    setLoading(true);
    setSubmitError(null);

    try {
      await api.auth.register(data.username, data.email, data.password);
      toast.success("Account created");
      setLocation("/dashboard");
    } catch (error) {
      const apiError = error as ApiError;
      if (apiError?.status === 409) {
        form.setError("email", { message: "An account with this email already exists. Log in instead?" });
      } else {
        setSubmitError(
          apiError?.status === 0
            ? "The server could not be reached. Check your connection and try again."
            : error instanceof Error && error.message
              ? error.message
              : "Registration failed. Please try again.",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="my-8 flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Create an account</h1>
          <CardDescription>An account lets you save arguments and come back to them.</CardDescription>
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
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input autoComplete="username" placeholder="e.g. ada_l" {...field} disabled={loading} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                      <Input type="password" autoComplete="new-password" {...field} disabled={loading} />
                    </FormControl>
                    <FormDescription>
                      At least 8 characters, with an uppercase letter, a lowercase letter and a number.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm password</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="new-password" {...field} disabled={loading} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="animate-spin" aria-hidden="true" />}
                {loading ? "Creating account…" : "Create account"}
              </Button>
            </form>
          </Form>
        </CardContent>

        <CardFooter className="justify-center">
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
              Log in
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
