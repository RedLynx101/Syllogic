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
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl mx-auto px-4 py-8 flex flex-col min-h-screen">
        <div className="flex-grow space-y-6">
          <div className="text-center space-y-3">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Syllogic
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Evaluate syllogistic arguments using the eight fundamental logical rules
            </p>
          </div>

          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Premises</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
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
                  className="w-full sm:w-auto"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Premise
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-lg">
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
            className="w-full font-semibold shadow-lg"
            size="lg"
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
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>Proof</CardTitle>
              </CardHeader>
              <CardContent>
                <ProofDisplay {...proof} />
              </CardContent>
            </Card>
          )}
        </div>

        <footer className="text-center text-sm text-muted-foreground py-6">
          &copy; {new Date().getFullYear()} Syllogic. Created by Noah Hicks
        </footer>
      </div>
    </div>
  );
}