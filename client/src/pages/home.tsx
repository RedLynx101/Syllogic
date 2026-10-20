import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PremiseInput } from "@/components/ui/premise-input";
import { ProofDisplay } from "@/components/ui/proof-display";
import { Premise, PremiseForm, type Proof, type SyllogismRecord } from "@shared/schema";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/queryClient";
import { Loader2, Plus, Save } from "lucide-react";
import { useAuth } from "@/App";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocation, useSearch } from "wouter";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type EvaluateResponse = {
  proof: Proof;
  savedArgument?: SyllogismRecord;
};

const defaultPremise = (): Premise => ({
  form: PremiseForm.A,
  subject: "",
  predicate: "",
});

export default function Home() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const idParam = params.get("id");
  const argumentId = idParam ? parseInt(idParam, 10) : null;
  const isEditMode = params.get("edit") === "true";
  const isReadOnly = argumentId !== null && !isEditMode;

  const [premises, setPremises] = useState<Premise[]>([defaultPremise(), defaultPremise()]);
  const [conclusion, setConclusion] = useState<Premise>(defaultPremise());
  const [proof, setProof] = useState<Proof | null>(null);
  const [name, setName] = useState<string>("");
  const [argumentLoaded, setArgumentLoaded] = useState<boolean>(false);
  const [showOverwriteDialog, setShowOverwriteDialog] = useState<boolean>(false);
  const [pendingArgument, setPendingArgument] = useState<any>(null);
  
  // Fetch existing argument if ID provided
  const { data: existingArgument, isLoading: loadingArgument } = useQuery<SyllogismRecord>({
    queryKey: [argumentId ? `/api/arguments/${argumentId}` : null],
    enabled: !!argumentId,
  });
  
  // Fetch user's arguments to check for duplicates
  const { data: userArguments } = useQuery<SyllogismRecord[]>({
    queryKey: [isAuthenticated ? "/api/user/arguments" : null],
    enabled: isAuthenticated,
  });

  // Load argument data
  useEffect(() => {
    if (existingArgument && !argumentLoaded) {
      setPremises(existingArgument.premises || [defaultPremise(), defaultPremise()]);
      setConclusion(existingArgument.conclusion || defaultPremise());
      setProof(existingArgument.proof || null);
      setName(existingArgument.name || "");
      setArgumentLoaded(true);
    }
  }, [existingArgument, argumentLoaded]);

  // Evaluate mutation
  const evaluateMutation = useMutation({
    mutationFn: async () => {
      const validPremises = premises.filter(p => 
        p.subject.trim() !== "" && p.predicate.trim() !== ""
      );
      
      if (validPremises.length < 2) {
        throw new Error("At least 2 valid premises are required");
      }
      
      const validConclusion = conclusion.subject.trim() !== "" && conclusion.predicate.trim() !== "";
      
      // Evaluate only; the server persists nothing unless `save: true` is sent
      return await api.post<EvaluateResponse>("/api/evaluate", {
        premises: validPremises,
        conclusion: validConclusion ? conclusion : undefined,
      });
    },
    onSuccess: (data) => {
      setProof(data.proof);
      // Remove auto-navigation to new argument
    },
    onError: (error) => {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Failed to evaluate argument");
      }
    }
  });

  // Save/update mutation
  const saveMutation = useMutation({
    mutationFn: async (): Promise<{ savedArgument?: SyllogismRecord }> => {
      if (!isAuthenticated) {
        throw new Error("You must be logged in to save arguments");
      }
      
      if (!proof) {
        throw new Error("Evaluate the argument before saving");
      }
      
      const argumentData = {
        name: name.trim() !== "" ? name : "Untitled Argument",
        premises,
        conclusion,
      };
      
      if (argumentId) {
        const updated = await api.put<SyllogismRecord>(`/api/arguments/${argumentId}`, argumentData);
        return { savedArgument: updated };
      } else {
        return await api.post<EvaluateResponse>("/api/evaluate", { ...argumentData, save: true });
      }
    },
    onSuccess: (data) => {
      toast.success("Argument saved successfully");
      queryClient.invalidateQueries({ queryKey: ["/api/user/arguments"] });
      if (data.savedArgument && !argumentId) {
        setLocation(`/?id=${data.savedArgument.id}`);
      }
    },
    onError: (error) => {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Failed to save argument");
      }
    }
  });

  const addPremise = () => {
    if (premises.length < 50) {
      setPremises([...premises, defaultPremise()]);
    }
  };

  const removePremise = (index: number) => {
    if (premises.length > 2) {
      setPremises(premises.filter((_, i) => i !== index));
    }
  };

  const updatePremise = (index: number, premise: Premise) => {
    setPremises(premises.map((p, i) => i === index ? premise : p));
  };

  const hasMissingFields = () => {
    return premises.some(p => p.subject.trim() === "" || p.predicate.trim() === "") || 
      conclusion.subject.trim() === "" || 
      conclusion.predicate.trim() === "";
  };

  const validateFields = () => {
    if (premises.length < 2) {
      toast.error("At least 2 premises are required");
      return false;
    }
    
    if (hasMissingFields()) {
      toast.error("All fields must be filled");
      return false;
    }
    
    return true;
  };

  const handleEvaluate = () => {
    if (validateFields()) {
      evaluateMutation.mutate();
    }
  };

  const handleSave = () => {
    if (!isAuthenticated) {
      toast.error("You must be logged in to save arguments", {
        action: {
          label: "Login",
          onClick: () => setLocation("/login"),
        },
      });
      return;
    }
    
    if (validateFields()) {
      if (!proof) {
        handleEvaluate();
        toast.info("Please evaluate your argument before saving");
        return;
      }
      
      // Check for duplicate names
      const argumentName = name.trim() !== "" ? name : "Untitled Argument";
      const existingWithSameName = userArguments?.find(
        arg => arg.name === argumentName && arg.id !== argumentId
      );
      
      if (existingWithSameName) {
        // Store argument data temporarily
        setPendingArgument({
          name: argumentName,
          premises,
          conclusion,
        });
        
        // Show confirmation dialog
        setShowOverwriteDialog(true);
      } else {
        // No duplicate, proceed with save
        saveMutation.mutate();
      }
    }
  };
  
  const confirmOverwrite = () => {
    // Close dialog
    setShowOverwriteDialog(false);
    
    // Proceed with save
    if (pendingArgument) {
      saveMutation.mutate();
    }
  };
  
  const cancelOverwrite = () => {
    setShowOverwriteDialog(false);
    setPendingArgument(null);
  };

  // Display loading state while fetching argument
  if (argumentId && loadingArgument) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading argument...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overwrite Confirmation Dialog */}
      <AlertDialog open={showOverwriteDialog} onOpenChange={setShowOverwriteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Overwrite Existing Argument?</AlertDialogTitle>
            <AlertDialogDescription>
              An argument with the name "{pendingArgument?.name}" already exists.
              Do you want to save this argument anyway? The existing argument will remain
              but this might cause confusion with duplicate names.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelOverwrite}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmOverwrite}>Save Anyway</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <div className="flex flex-col lg:flex-row justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {argumentId 
              ? isEditMode 
                ? "Edit Argument" 
                : "View Argument"
              : "New Argument"
            }
          </h1>
          <p className="text-muted-foreground mt-1">
            {argumentId 
              ? "Examine or modify this syllogistic argument"
              : "Create and evaluate a new syllogistic argument"
            }
          </p>
        </div>
        
        {argumentId && !isEditMode && (
          <Button
            variant="outline"
            onClick={() => setLocation(`/?id=${argumentId}&edit=true`)}
          >
            Edit Argument
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="space-y-1">
          <CardTitle>Argument Name</CardTitle>
          <CardDescription>Give your argument a memorable name</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="argument-name">Name</Label>
            <Input
              id="argument-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Socrates Mortality Argument"
              disabled={isReadOnly}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Premises</CardTitle>
          <CardDescription>Add at least two premises to your argument</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {premises.map((premise, index) => (
            <PremiseInput
              key={index}
              value={premise}
              onChange={(p) => updatePremise(index, p)}
              onRemove={() => removePremise(index)}
              disabled={isReadOnly}
            />
          ))}

          {premises.length < 50 && (argumentId ? isEditMode : true) && (
            <Button
              variant="outline"
              size="sm"
              onClick={addPremise}
              className="w-full sm:w-auto"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Premise
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Conclusion</CardTitle>
          <CardDescription>The statement to be proven from the premises</CardDescription>
        </CardHeader>
        <CardContent>
          <PremiseInput
            value={conclusion}
            onChange={setConclusion}
            isConclusion
            disabled={isReadOnly}
          />
        </CardContent>
      </Card>

      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          className="flex-1 font-semibold shadow-md"
          size="lg"
          onClick={handleEvaluate}
          disabled={evaluateMutation.isPending || isReadOnly}
        >
          {evaluateMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Evaluating...
            </>
          ) : (
            "Evaluate Argument"
          )}
        </Button>

        {isAuthenticated && (
          <Button
            className="flex-1 font-semibold shadow-md"
            size="lg"
            variant="outline"
            onClick={handleSave}
            disabled={saveMutation.isPending || isReadOnly}
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                {argumentId ? "Update" : "Save"}
              </>
            )}
          </Button>
        )}
      </div>

      {proof && (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Proof</CardTitle>
            <CardDescription>
              {proof.isValid
                ? "Valid argument: The conclusion follows from the premises"
                : "Invalid argument: The conclusion does not follow from the premises"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ProofDisplay {...proof} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}