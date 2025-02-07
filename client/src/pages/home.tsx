import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PremiseInput } from "@/components/ui/premise-input";
import { ProofDisplay } from "@/components/ui/proof-display";
import { Premise, PremiseForm, type Proof } from "@shared/schema";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Plus } from "lucide-react";

const defaultPremise = (): Premise => ({
  form: PremiseForm.A,
  subject: "",
  predicate: "",
});

export default function Home() {
  const [premises, setPremises] = useState<Premise[]>([defaultPremise(), defaultPremise()]);
  const [conclusion, setConclusion] = useState<Premise>(defaultPremise());
  const [proof, setProof] = useState<Proof | null>(null);

  const evaluateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/evaluate", {
        premises,
        conclusion,
      });
      return res.json();
    },
    onSuccess: (data: Proof) => {
      setProof(data);
    },
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

  return (
    <div className="container max-w-4xl py-8 space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold tracking-tight">Syllogic</h1>
        <p className="text-muted-foreground">
          Evaluate syllogistic arguments using the eight fundamental logical rules
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Premises</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {premises.map((premise, index) => (
            <PremiseInput
              key={index}
              value={premise}
              onChange={(p) => updatePremise(index, p)}
              onRemove={() => removePremise(index)}
            />
          ))}
          
          {premises.length < 50 && (
            <Button
              variant="outline"
              size="sm"
              onClick={addPremise}
              className="mt-2"
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
        </CardHeader>
        <CardContent>
          <PremiseInput
            value={conclusion}
            onChange={setConclusion}
            isConclusion
          />
        </CardContent>
      </Card>

      <Button 
        className="w-full"
        onClick={() => evaluateMutation.mutate()}
        disabled={evaluateMutation.isPending}
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

      {proof && (
        <Card>
          <CardHeader>
            <CardTitle>Proof</CardTitle>
          </CardHeader>
          <CardContent>
            <ProofDisplay {...proof} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
