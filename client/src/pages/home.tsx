import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PremiseInput } from "@/components/ui/premise-input";
import { ProofDisplay } from "@/components/ui/proof-display";
import { Premise, PremiseForm, type Proof } from "@shared/schema";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/queryClient";
import { Loader2, Plus, Save } from "lucide-react";
import { useAuth } from "@/App";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocation, useSearch } from "wouter";

const defaultPremise = (): Premise => ({
  form: PremiseForm.A,
  subject: "",
  predicate: "",
});

export default function Home() {
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [search] = useSearch();
  const params = new URLSearchParams(search);
  const argumentId = params.get("id") ? parseInt(params.get("id")) : null;
  const isEditMode = params.get("edit") === "true";

  const [premises, setPremises] = useState<Premise[]>([defaultPremise(), defaultPremise()]);
  const [conclusion, setConclusion] = useState<Premise>(defaultPremise());
  const [proof, setProof] = useState<Proof | null>(null);
  const [name, setName] = useState<string>("");
  const [argumentLoaded, setArgumentLoaded] = useState<boolean>(false);
  
  // Fetch existing argument if ID provided
  const { data: existingArgument, isLoading: loadingArgument } = useQuery({
    queryKey: [argumentId ? `/api/arguments/${argumentId}` : null],
    enabled: !!argumentId,
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
      
      return await api.post("/api/evaluate", {
        name: name.trim() !== "" ? name : "Untitled Argument",
        premises: validPremises,
        conclusion: validConclusion ? conclusion : undefined,
      });
    },
    onSuccess: (data) => {
      setProof(data.proof);
      if (data.savedArgument && !argumentId) {
        // Navigate to the saved argument
        setLocation(`/?id=${data.savedArgument.id}`);
        toast.success("Argument saved successfully");
      }
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
    mutationFn: async () => {
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
        return await api.put(`/api/arguments/${argumentId}`, argumentData);
      } else {
        return await api.post("/api/evaluate", argumentData);
      }
    },
    onSuccess: (data) => {
      toast.success("Argument saved successfully");
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
      } else {
        saveMutation.mutate();
      }
    }
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
              disabled={argumentId && !isEditMode}
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
              disabled={argumentId && !isEditMode}
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
            disabled={argumentId && !isEditMode}
          />
        </CardContent>
      </Card>

      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          className="flex-1 font-semibold shadow-md"
          size="lg"
          onClick={handleEvaluate}
          disabled={evaluateMutation.isPending || (argumentId && !isEditMode)}
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
            disabled={saveMutation.isPending || (argumentId && !isEditMode)}
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