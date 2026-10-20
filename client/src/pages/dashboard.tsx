import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { AlertCircle, CheckCircle2, CircleDashed, FileText, Pencil, Plus, Search, Sparkles, Trash2, XCircle } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { motion, AnimatePresence, MotionConfig } from "framer-motion";
import { api } from "@/lib/queryClient";
import { formatStatement } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import type { SyllogismRecord } from "@shared/schema";

export function ValidityBadge({ isValid, className }: { isValid: boolean | undefined; className?: string }) {
  const variant =
    isValid === undefined
      ? { label: "Not evaluated", Icon: CircleDashed, tone: "border-border bg-muted text-foreground" }
      : isValid
        ? { label: "Valid", Icon: CheckCircle2, tone: "border-emerald-200 bg-emerald-50 text-emerald-800" }
        : { label: "Invalid", Icon: XCircle, tone: "border-red-200 bg-red-50 text-red-800" };
  const { label, Icon, tone } = variant;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold",
        tone,
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </span>
  );
}

const nameOf = (argument: SyllogismRecord) => argument.name || "Untitled Argument";

export default function Dashboard() {
  useDocumentTitle("My Arguments");
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<SyllogismRecord | null>(null);

  const {
    data: userArguments,
    isLoading,
    isError,
    refetch,
  } = useQuery<SyllogismRecord[]>({
    queryKey: ["/api/user/arguments"],
    staleTime: 1000 * 60,
  });

  const deleteMutation = useMutation({
    mutationFn: (argumentId: number) => api.delete(`/api/arguments/${argumentId}`),
    onSuccess: (_data, argumentId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/arguments"] });
      queryClient.removeQueries({ queryKey: [`/api/arguments/${argumentId}`] });
      toast.success("Argument deleted");
      setDeleteTarget(null);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Could not delete the argument");
    },
  });

  const query = searchTerm.trim().toLowerCase();
  const filteredArguments = (userArguments ?? []).filter((arg) => {
    if (!query) return true;
    if (nameOf(arg).toLowerCase().includes(query)) return true;
    return [...arg.premises, arg.conclusion].some(
      (p) => p.subject.toLowerCase().includes(query) || p.predicate.toLowerCase().includes(query),
    );
  });

  const total = userArguments?.length ?? 0;
  const validCount = userArguments?.filter((a) => a.proof?.isValid).length ?? 0;
  const invalidCount = userArguments?.filter((a) => a.proof && !a.proof.isValid).length ?? 0;

  return (
    <MotionConfig reducedMotion="user">
      <div className="space-y-6">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">My Arguments</h1>
            <p className="text-muted-foreground">Arguments you have saved. Only your account can see them.</p>
          </div>
          <Button asChild>
            <Link href="/">
              <Plus aria-hidden="true" />
              New argument
            </Link>
          </Button>
        </div>

        {isLoading ? (
          <Card aria-busy="true" aria-label="Loading saved arguments">
            <CardContent className="space-y-3 p-6">
              <Skeleton className="h-6 w-1/3" />
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </CardContent>
          </Card>
        ) : isError ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 p-8 text-center" role="alert">
              <AlertCircle className="h-8 w-8 text-red-700" aria-hidden="true" />
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">Could not load your arguments</h2>
                <p className="text-sm text-muted-foreground">The server did not respond as expected.</p>
              </div>
              <Button type="button" onClick={() => refetch()}>
                Try again
              </Button>
            </CardContent>
          </Card>
        ) : total === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 px-6 py-12 text-center">
              <div className="rounded-full bg-muted p-3">
                <FileText className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
              </div>
              <div className="max-w-md space-y-1">
                <h2 className="text-lg font-semibold">No saved arguments yet</h2>
                <p className="text-sm text-muted-foreground">
                  Check an argument, then press Save to keep it here with its proof. Not sure where to start? Load
                  a classic example.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                <Button asChild>
                  <Link href="/">
                    <Plus aria-hidden="true" />
                    Check an argument
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/?example=barbara">
                    <Sparkles aria-hidden="true" />
                    Try the Barbara example
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full max-w-sm">
                <Search
                  className="pointer-events-none absolute left-2.5 top-3 h-4 w-4 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  type="search"
                  aria-label="Search saved arguments by name or term"
                  placeholder="Search by name or term…"
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <p className="text-sm text-muted-foreground" aria-live="polite">
                {query
                  ? `${filteredArguments.length} of ${total} shown`
                  : `${total} saved · ${validCount} valid · ${invalidCount} invalid`}
              </p>
            </div>

            {filteredArguments.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
                  <h2 className="text-lg font-semibold">No arguments match “{searchTerm.trim()}”</h2>
                  <Button type="button" variant="outline" onClick={() => setSearchTerm("")}>
                    Clear search
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card className="overflow-hidden">
                <Table>
                  <caption className="sr-only">Saved arguments, most recently updated first</caption>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead>Name</TableHead>
                      <TableHead className="hidden md:table-cell">Argument</TableHead>
                      <TableHead className="hidden md:table-cell">Result</TableHead>
                      <TableHead className="hidden sm:table-cell">Updated</TableHead>
                      <TableHead className="text-right">
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <AnimatePresence initial={false}>
                      {filteredArguments.map((argument) => (
                        <motion.tr
                          key={argument.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="border-b transition-colors hover:bg-muted/40"
                        >
                          <TableCell className="align-top">
                            <Link
                              href={`/?id=${argument.id}`}
                              className="rounded-sm font-semibold underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              {nameOf(argument)}
                            </Link>
                            <p className="mt-0.5 text-sm text-muted-foreground md:hidden">
                              <span aria-hidden="true">∴ </span>
                              <span className="sr-only">Conclusion: </span>
                              {formatStatement(argument.conclusion)}
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-2 md:hidden">
                              <ValidityBadge isValid={argument.proof?.isValid} />
                              <span className="text-xs text-muted-foreground sm:hidden">
                                {format(new Date(argument.updatedAt), "MMM d, yyyy")}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="hidden max-w-[28rem] align-top md:table-cell">
                            <div className="space-y-0.5 text-sm text-muted-foreground">
                              {argument.premises.slice(0, 2).map((p, i) => (
                                <div key={i} className="truncate">
                                  {formatStatement(p)}
                                </div>
                              ))}
                              {argument.premises.length > 2 && (
                                <div>+{argument.premises.length - 2} more</div>
                              )}
                            </div>
                            <div className="truncate text-sm font-medium">
                              <span aria-hidden="true">∴ </span>
                              <span className="sr-only">Conclusion: </span>
                              {formatStatement(argument.conclusion)}
                            </div>
                          </TableCell>
                          <TableCell className="hidden align-top md:table-cell">
                            <ValidityBadge isValid={argument.proof?.isValid} />
                          </TableCell>
                          <TableCell className="hidden whitespace-nowrap align-top text-sm text-muted-foreground sm:table-cell">
                            {format(new Date(argument.updatedAt), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell className="align-top">
                            <div className="flex justify-end gap-1">
                              <Button asChild size="icon" variant="ghost" title="Edit">
                                <Link href={`/?id=${argument.id}&edit=true`} aria-label={`Edit ${nameOf(argument)}`}>
                                  <Pencil aria-hidden="true" />
                                </Link>
                              </Button>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="text-red-700 hover:bg-red-50 hover:text-red-800"
                                title="Delete"
                                aria-label={`Delete ${nameOf(argument)}`}
                                onClick={() => setDeleteTarget(argument)}
                              >
                                <Trash2 aria-hidden="true" />
                              </Button>
                            </div>
                          </TableCell>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </TableBody>
                </Table>
              </Card>
            )}
          </>
        )}

        <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete “{deleteTarget ? nameOf(deleteTarget) : ""}”?</AlertDialogTitle>
              <AlertDialogDescription>
                The argument and its proof will be removed from your account. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
              <Button
                type="button"
                variant="destructive"
                onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? "Deleting…" : "Delete"}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MotionConfig>
  );
}
