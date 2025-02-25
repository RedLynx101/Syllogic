import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Edit2, Trash2, Plus, Eye, AlertCircle, Search } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/queryClient";
import { useAuth } from "@/App";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { PremiseForm } from "@shared/schema";

export default function Dashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  // Fetch user's arguments
  const { data: userArguments, isLoading } = useQuery({
    queryKey: ["/api/user/arguments"],
    staleTime: 1000 * 60, // 1 minute
  });

  // Delete argument mutation
  const deleteMutation = useMutation({
    mutationFn: (argumentId: number) => api.delete(`/api/arguments/${argumentId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/arguments"] });
      toast.success("Argument deleted successfully");
      setDeleteConfirmId(null);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to delete argument");
    },
  });

  // Handle delete confirmation
  const handleDelete = (id: number) => {
    deleteMutation.mutate(id);
  };

  // Filter arguments based on search term
  const filteredArguments = userArguments?.filter((arg: any) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    
    // Search in name
    if (arg.name?.toLowerCase().includes(searchLower)) return true;
    
    // Search in premises and conclusion
    const hasMatchInPremises = arg.premises.some((p: any) => 
      p.subject.toLowerCase().includes(searchLower) || 
      p.predicate.toLowerCase().includes(searchLower)
    );
    
    const hasMatchInConclusion = 
      arg.conclusion?.subject.toLowerCase().includes(searchLower) || 
      arg.conclusion?.predicate.toLowerCase().includes(searchLower);
    
    return hasMatchInPremises || hasMatchInConclusion;
  });

  // Helper to format premise for display
  const formatPremise = (premise: any) => {
    const form = premise.form;
    const subject = premise.subject;
    const predicate = premise.predicate;
    
    switch (form) {
      case PremiseForm.A:
        return `All ${subject} are ${predicate}`;
      case PremiseForm.E:
        return `No ${subject} are ${predicate}`;
      case PremiseForm.I:
        return `Some ${subject} are ${predicate}`;
      case PremiseForm.O:
        return `Some ${subject} are not ${predicate}`;
      default:
        return `${subject} - ${predicate}`;
    }
  };

  // Get validity badge for an argument
  const validityBadge = (isValid: boolean) => (
    <Badge variant={isValid ? "success" : "destructive"}>
      {isValid ? "Valid" : "Invalid"}
    </Badge>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Arguments</h1>
          <p className="text-muted-foreground">
            Manage your saved syllogistic arguments
          </p>
        </div>
        <Link href="/">
          <Button className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            New Argument
          </Button>
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-2 mb-4">
        <div className="relative w-full sm:w-auto flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search arguments..."
            className="pl-8 w-full"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Array(3).fill(0).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : filteredArguments?.length === 0 ? (
        <Card>
          <CardHeader className="text-center">
            <CardTitle>No arguments found</CardTitle>
            <CardDescription>
              {searchTerm 
                ? "Try a different search term or clear the search" 
                : "Create your first argument to get started"}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            {!searchTerm ? (
              <Link href="/">
                <Button className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Create Argument
                </Button>
              </Link>
            ) : (
              <Button 
                variant="outline" 
                onClick={() => setSearchTerm("")}
                className="flex items-center gap-2"
              >
                Clear Search
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden md:table-cell">Premises & Conclusion</TableHead>
                  <TableHead className="hidden md:table-cell">Validity</TableHead>
                  <TableHead className="hidden sm:table-cell">Last Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <AnimatePresence>
                  {filteredArguments?.map((argument: any) => (
                    <motion.tr
                      key={argument.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                      layout
                    >
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <span className="font-semibold truncate max-w-[150px]">
                            {argument.name || "Untitled Argument"}
                          </span>
                          <span className="md:hidden text-xs text-muted-foreground">
                            {validityBadge(argument.proof.isValid)}
                          </span>
                          <span className="sm:hidden text-xs text-muted-foreground">
                            {new Date(argument.updatedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="max-w-[300px] truncate">
                          <div className="text-muted-foreground text-sm">
                            {argument.premises.slice(0, 2).map((p: any, i: number) => (
                              <div key={i} className="truncate">
                                {formatPremise(p)}
                              </div>
                            ))}
                            {argument.premises.length > 2 && (
                              <div>+{argument.premises.length - 2} more</div>
                            )}
                          </div>
                          <div className="font-medium">
                            {formatPremise(argument.conclusion)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {validityBadge(argument.proof.isValid)}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">
                        {format(new Date(argument.updatedAt), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Link href={`/?id=${argument.id}`}>
                            <Button size="icon" variant="ghost" title="View">
                              <Eye className="h-4 w-4" />
                              <span className="sr-only">View</span>
                            </Button>
                          </Link>
                          <Link href={`/?id=${argument.id}&edit=true`}>
                            <Button size="icon" variant="ghost" title="Edit">
                              <Edit2 className="h-4 w-4" />
                              <span className="sr-only">Edit</span>
                            </Button>
                          </Link>
                          <Dialog open={deleteConfirmId === argument.id} onOpenChange={(open) => {
                            if (!open) setDeleteConfirmId(null);
                          }}>
                            <DialogTrigger asChild>
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                className="text-destructive hover:text-destructive"
                                title="Delete"
                                onClick={() => setDeleteConfirmId(argument.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                                <span className="sr-only">Delete</span>
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                  <AlertCircle className="h-5 w-5 text-destructive" />
                                  Confirm Deletion
                                </DialogTitle>
                                <DialogDescription>
                                  Are you sure you want to delete "{argument.name || "Untitled Argument"}"? 
                                  This action cannot be undone.
                                </DialogDescription>
                              </DialogHeader>
                              <DialogFooter className="gap-2 sm:gap-0">
                                <Button
                                  variant="outline"
                                  onClick={() => setDeleteConfirmId(null)}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  variant="destructive"
                                  onClick={() => handleDelete(argument.id)}
                                  disabled={deleteMutation.isPending}
                                >
                                  {deleteMutation.isPending ? "Deleting..." : "Delete"}
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </TableCell>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}