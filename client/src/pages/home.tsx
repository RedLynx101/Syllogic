import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertCircle, ArrowLeft, Loader2, LogIn, Pencil, Play, Plus, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PremiseInput } from "@/components/ui/premise-input";
import { ProofDisplay } from "@/components/ui/proof-display";
import { HowItWorks } from "@/components/how-it-works";
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
import { PremiseForm, type Premise, type Proof, type SyllogismRecord } from "@shared/schema";
import { api, type ApiError } from "@/lib/queryClient";
import { findExample, type ExampleArgument } from "@/lib/examples";
import { formatStatement } from "@/lib/format";
import { useAuth } from "@/App";
import { useDocumentTitle } from "@/hooks/use-document-title";

type EvaluateResponse = {
  proof: Proof;
  savedArgument?: SyllogismRecord;
};

type Draft = { premises: Premise[]; conclusion: Premise };

const MAX_PREMISES = 50;

const blankPremise = (): Premise => ({ form: PremiseForm.A, subject: "", predicate: "" });

/** Trims a term while keeping its "non-" prefix, so " Greeks" and "Greeks" match. */
const cleanTerm = (term: string) => {
  const negated = /^non-/.test(term);
  const bare = term.replace(/^non-/, "").trim();
  return negated ? `non-${bare}` : bare;
};

const cleanPremise = (p: Premise): Premise => ({ ...p, subject: cleanTerm(p.subject), predicate: cleanTerm(p.predicate) });

const cleanDraft = (draft: Draft): Draft => ({
  premises: draft.premises.map(cleanPremise),
  conclusion: cleanPremise(draft.conclusion),
});

const snapshot = (draft: Draft) => JSON.stringify(cleanDraft(draft));

const isBlank = (p: Premise) => cleanTerm(p.subject).replace(/^non-/, "") === "" || cleanTerm(p.predicate).replace(/^non-/, "") === "";

function describeError(error: unknown, action: string): { title: string; message: string; signIn?: boolean } {
  const apiError = error as ApiError;
  if (apiError?.status === 0) {
    return { title: `Could not ${action}`, message: "The server could not be reached. Check your connection and try again." };
  }
  if (apiError?.status === 401) {
    return { title: `Could not ${action}`, message: "Your session has ended. Log in again to save arguments.", signIn: true };
  }
  return {
    title: `Could not ${action}`,
    message: error instanceof Error && error.message ? error.message : "Something went wrong. Please try again.",
  };
}

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export default function Home() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const idParam = params.get("id");
  const argumentId = idParam && /^\d+$/.test(idParam) ? Number(idParam) : null;
  const invalidIdParam = idParam !== null && argumentId === null;
  const isEditMode = argumentId !== null && params.get("edit") === "true";
  const isReadOnly = argumentId !== null && !isEditMode;
  const isNew = argumentId === null;

  const [premises, setPremises] = useState<Premise[]>([blankPremise(), blankPremise()]);
  const [conclusion, setConclusion] = useState<Premise>(blankPremise());
  const [name, setName] = useState("");
  const [proof, setProof] = useState<Proof | null>(null);
  const [proofFor, setProofFor] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [formError, setFormError] = useState<ReturnType<typeof describeError> | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [argumentLoaded, setArgumentLoaded] = useState(false);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  // Load a saved argument (signed-in owner only; the API answers 401/404 otherwise)
  const {
    data: existingArgument,
    isLoading: loadingArgument,
    error: loadError,
    refetch,
  } = useQuery<SyllogismRecord>({
    queryKey: [argumentId ? `/api/arguments/${argumentId}` : null],
    enabled: argumentId !== null && !authLoading,
  });

  // The caller's arguments, to warn before saving a second argument with the same name
  const { data: userArguments } = useQuery<SyllogismRecord[]>({
    queryKey: [isAuthenticated ? "/api/user/arguments" : null],
    enabled: isAuthenticated,
  });

  useDocumentTitle(
    invalidIdParam || loadError
      ? "Argument unavailable"
      : isNew
        ? "Check an argument"
        : isEditMode
          ? "Edit argument"
          : name || "Saved argument",
  );

  useEffect(() => {
    if (existingArgument && !argumentLoaded) {
      const draft = { premises: existingArgument.premises, conclusion: existingArgument.conclusion };
      setPremises(draft.premises);
      setConclusion(draft.conclusion);
      setName(existingArgument.name || "");
      setProof(existingArgument.proof ?? null);
      setProofFor(existingArgument.proof ? snapshot(draft) : null);
      setArgumentLoaded(true);
    }
  }, [existingArgument, argumentLoaded]);

  const draft: Draft = { premises, conclusion };
  const proofIsStale = proof !== null && proofFor !== null && proofFor !== snapshot(draft);

  const showResult = (result: Proof, forDraft: Draft) => {
    setProof(result);
    setProofFor(snapshot(forDraft));
    setAnnouncement(
      `${result.isValid ? "Valid argument" : "Invalid argument"}. ${result.steps.length} steps listed.`,
    );
    // On narrow screens the result sits below the editor: bring it into view.
    requestAnimationFrame(() => {
      const el = resultRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (rect.top > window.innerHeight - 80 || rect.bottom < 0) {
        el.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
      }
    });
  };

  const evaluateMutation = useMutation({
    mutationFn: async (input: Draft) =>
      api.post<EvaluateResponse>("/api/evaluate", cleanDraft(input)),
    onSuccess: (data, input) => showResult(data.proof, input),
    onError: (error) => setFormError(describeError(error, "evaluate the argument")),
  });

  const saveMutation = useMutation({
    mutationFn: async (): Promise<{ record: SyllogismRecord; proof: Proof }> => {
      const payload = { name: name.trim() || "Untitled Argument", ...cleanDraft(draft) };
      if (argumentId !== null) {
        const record = await api.put<SyllogismRecord>(`/api/arguments/${argumentId}`, payload);
        return { record, proof: record.proof as Proof };
      }
      const response = await api.post<EvaluateResponse>("/api/evaluate", { ...payload, save: true });
      return { record: response.savedArgument as SyllogismRecord, proof: response.proof };
    },
    onSuccess: ({ record, proof: savedProof }) => {
      showResult(savedProof, draft);
      toast.success(argumentId !== null ? "Changes saved" : "Argument saved");
      queryClient.invalidateQueries({ queryKey: ["/api/user/arguments"] });
      queryClient.invalidateQueries({ queryKey: [`/api/arguments/${record.id}`] });
      setLocation(`/?id=${record.id}`);
    },
    onError: (error) => setFormError(describeError(error, "save the argument")),
  });

  const busy = evaluateMutation.isPending || saveMutation.isPending;

  // `/?example=barbara` loads and evaluates an example (linked from the empty dashboard)
  const exampleParam = params.get("example");
  useEffect(() => {
    const example = isNew ? findExample(exampleParam) : undefined;
    if (example) {
      loadExample(example);
      setLocation("/", { replace: true });
    }
    // Only on first render of a new argument
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function loadExample(example: ExampleArgument) {
    const exampleDraft = { premises: example.premises.map((p) => ({ ...p })), conclusion: { ...example.conclusion } };
    setPremises(exampleDraft.premises);
    setConclusion(exampleDraft.conclusion);
    setName(example.name);
    setShowErrors(false);
    setFormError(null);
    evaluateMutation.mutate(exampleDraft);
  }

  const addPremise = () => {
    if (premises.length < MAX_PREMISES) setPremises([...premises, blankPremise()]);
  };

  const removePremise = (index: number) => {
    if (premises.length > 2) setPremises(premises.filter((_, i) => i !== index));
  };

  const updatePremise = (index: number, premise: Premise) => {
    setPremises(premises.map((p, i) => (i === index ? premise : p)));
  };

  /** Checks every term is filled; otherwise flags the blanks and focuses the first one. */
  const validate = () => {
    if (premises.some(isBlank) || isBlank(conclusion)) {
      setShowErrors(true);
      setFormError({
        title: "Some terms are empty",
        message: "Fill in the subject and predicate of every premise and of the conclusion.",
      });
      requestAnimationFrame(() => {
        document.querySelector<HTMLInputElement>('#argument-editor [aria-invalid="true"]')?.focus();
      });
      return false;
    }
    setShowErrors(false);
    setFormError(null);
    return true;
  };

  const handleEvaluate = () => {
    if (validate()) evaluateMutation.mutate(draft);
  };

  const handleSave = () => {
    if (!validate()) return;
    const argumentName = name.trim() || "Untitled Argument";
    const duplicate = userArguments?.some((arg) => arg.name === argumentName && arg.id !== argumentId);
    if (duplicate) {
      setShowDuplicateDialog(true);
    } else {
      saveMutation.mutate();
    }
  };

  // ----- Loading and error states for a saved argument -----

  if (invalidIdParam) {
    return <ArgumentUnavailable title="Argument not found" message="That link does not point to a saved argument." />;
  }

  if (argumentId !== null && (authLoading || loadingArgument)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center" role="status">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
          <p className="text-muted-foreground">Loading argument…</p>
        </div>
      </div>
    );
  }

  if (argumentId !== null && loadError) {
    const status = (loadError as ApiError).status;
    if (status === 401) {
      return (
        <ArgumentUnavailable
          title="Log in to see this argument"
          message="Saved arguments are private to the account that saved them."
          signIn
        />
      );
    }
    if (status === 404) {
      return (
        <ArgumentUnavailable
          title="Argument not found"
          message="It may have been deleted, or it was saved from a different account."
        />
      );
    }
    return (
      <ArgumentUnavailable
        title="Could not load this argument"
        message="The server did not respond as expected."
        onRetry={() => refetch()}
      />
    );
  }

  // ----- Page -----

  const heading = isNew ? "Check an argument" : isEditMode ? "Edit argument" : name || "Untitled Argument";
  const subheading = isNew
    ? "Write premises in the A, E, I and O forms, add a conclusion, and Syllogic will try to prove it step by step."
    : isEditMode
      ? "Change the premises or conclusion, then save. The proof is recomputed on save."
      : "A saved argument and the proof Syllogic produced for it.";

  return (
    <div className="space-y-6">
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>

      <AlertDialog open={showDuplicateDialog} onOpenChange={setShowDuplicateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Use the same name twice?</AlertDialogTitle>
            <AlertDialogDescription>
              You already have an argument called “{name.trim() || "Untitled Argument"}”. Saving keeps both, so
              you will see two arguments with this name on My Arguments.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowDuplicateDialog(false);
                saveMutation.mutate();
              }}
            >
              Save anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          {!isNew && (
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1 rounded-sm text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              My Arguments
            </Link>
          )}
          <h1 className="break-words text-3xl font-bold tracking-tight">{heading}</h1>
          <p className="max-w-2xl text-muted-foreground">{subheading}</p>
        </div>
        {isReadOnly && (
          <Button asChild variant="outline">
            <Link href={`/?id=${argumentId}&edit=true`}>
              <Pencil aria-hidden="true" />
              Edit argument
            </Link>
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
        {/* Editor (or read-only argument) */}
        <section
          id="argument-editor"
          aria-label={isReadOnly ? "Argument" : "Argument editor"}
          className="order-2 lg:order-1 lg:col-span-7"
        >
          {isReadOnly ? (
            <ArgumentSummary premises={premises} conclusion={conclusion} />
          ) : (
            <Card>
              <CardContent className="space-y-4 p-4 sm:p-6">
                <div className="space-y-2">
                  <Label htmlFor="argument-name">Name (optional)</Label>
                  <Input
                    id="argument-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Socrates is mortal"
                    maxLength={100}
                    autoComplete="off"
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <h2 className="text-base font-semibold">Premises</h2>
                    <span className="text-xs text-muted-foreground">
                      {premises.length} of {MAX_PREMISES} max
                    </span>
                  </div>
                  {premises.map((premise, index) => (
                    <PremiseInput
                      key={index}
                      label={`Premise ${index + 1}`}
                      value={premise}
                      onChange={(p) => updatePremise(index, p)}
                      onRemove={premises.length > 2 ? () => removePremise(index) : undefined}
                      showErrors={showErrors}
                    />
                  ))}
                  {premises.length < MAX_PREMISES && (
                    <Button type="button" variant="outline" size="sm" onClick={addPremise}>
                      <Plus aria-hidden="true" />
                      Add premise
                    </Button>
                  )}
                </div>

                <div className="space-y-3">
                  <h2 className="text-base font-semibold">Conclusion</h2>
                  <PremiseInput
                    label="Conclusion to test"
                    value={conclusion}
                    onChange={setConclusion}
                    showErrors={showErrors}
                  />
                </div>

                {formError && (
                  <Alert variant="destructive" className="border-red-300 bg-red-50 text-red-900 [&>svg]:text-red-700">
                    <AlertCircle className="h-4 w-4" aria-hidden="true" />
                    <AlertTitle>{formError.title}</AlertTitle>
                    <AlertDescription className="text-red-950">
                      {formError.message}
                      {formError.signIn && (
                        <>
                          {" "}
                          <Link href="/login" className="font-medium underline underline-offset-4">
                            Log in
                          </Link>
                        </>
                      )}
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button type="button" size="lg" className="font-semibold sm:flex-1" onClick={handleEvaluate} disabled={busy}>
                    {evaluateMutation.isPending ? (
                      <Loader2 className="animate-spin" aria-hidden="true" />
                    ) : (
                      <Play aria-hidden="true" />
                    )}
                    {evaluateMutation.isPending ? "Evaluating…" : "Evaluate"}
                  </Button>

                  {isAuthenticated && (
                    <Button
                      type="button"
                      size="lg"
                      variant="outline"
                      className="font-semibold sm:flex-1"
                      onClick={handleSave}
                      disabled={busy}
                    >
                      {saveMutation.isPending ? (
                        <Loader2 className="animate-spin" aria-hidden="true" />
                      ) : (
                        <Save aria-hidden="true" />
                      )}
                      {saveMutation.isPending ? "Saving…" : isEditMode ? "Save changes" : "Save"}
                    </Button>
                  )}
                  {isEditMode && (
                    <Button asChild size="lg" variant="ghost" className="sm:flex-none">
                      <Link href={`/?id=${argumentId}`}>Cancel</Link>
                    </Button>
                  )}
                </div>

                {!isAuthenticated && !authLoading && (
                  <p className="text-sm text-muted-foreground">
                    Evaluating needs no account.{" "}
                    <Link href="/register" className="font-medium text-foreground underline underline-offset-4">
                      Create an account
                    </Link>{" "}
                    or{" "}
                    <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
                      log in
                    </Link>{" "}
                    to save arguments.
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </section>

        {/* Result and guide. On small screens the guide moves above the editor. */}
        <div className="contents lg:order-2 lg:col-span-5 lg:block lg:space-y-6">
          {proof && (
            <section ref={resultRef} aria-labelledby="result-heading" className="order-3 scroll-mt-20">
              <Card className="shadow-md">
                <CardHeader className="pb-4">
                  <h2 id="result-heading" className="text-lg font-semibold leading-tight">
                    Result
                  </h2>
                  <CardDescription>
                    Conclusion tested: <span className="font-medium text-foreground">“{formatStatement(conclusion)}”</span>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ProofDisplay {...proof} conclusion={cleanPremise(conclusion)} stale={proofIsStale && !isReadOnly} />
                </CardContent>
              </Card>
            </section>
          )}
          {isNew && (
            <div className="order-1">
              <HowItWorks onLoadExample={loadExample} disabled={busy} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Read-only list of a saved argument's premises and conclusion. */
function ArgumentSummary({ premises, conclusion }: Draft) {
  return (
    <Card>
      <CardContent className="space-y-4 p-4 sm:p-6">
        <div>
          <h2 className="mb-2 text-base font-semibold">Premises</h2>
          <ol className="divide-y rounded-lg border">
            {premises.map((premise, index) => (
              <li key={index} className="flex items-baseline gap-3 px-3 py-2.5">
                <span className="w-6 font-mono text-sm tabular-nums text-muted-foreground">{index + 1}.</span>
                <span className="min-w-0 break-words font-medium">{formatStatement(premise)}</span>
                <span className="ml-auto rounded border px-1.5 font-mono text-xs text-muted-foreground">{premise.form}</span>
              </li>
            ))}
          </ol>
        </div>
        <div>
          <h2 className="mb-2 text-base font-semibold">Conclusion</h2>
          <p className="flex items-baseline gap-3 rounded-lg border bg-muted/30 px-3 py-2.5">
            <span className="w-6 text-muted-foreground" aria-hidden="true">
              ∴
            </span>
            <span className="min-w-0 break-words font-medium">{formatStatement(conclusion)}</span>
            <span className="ml-auto rounded border bg-background px-1.5 font-mono text-xs text-muted-foreground">
              {conclusion.form}
            </span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function ArgumentUnavailable({
  title,
  message,
  signIn,
  onRetry,
}: {
  title: string;
  message: string;
  signIn?: boolean;
  onRetry?: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <AlertCircle className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
          <div className="space-y-1">
            <h1 className="text-xl font-semibold">{title}</h1>
            <p className="text-muted-foreground">{message}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {signIn && (
              <Button asChild>
                <Link href="/login">
                  <LogIn aria-hidden="true" />
                  Log in
                </Link>
              </Button>
            )}
            {onRetry && (
              <Button type="button" onClick={onRetry}>
                Try again
              </Button>
            )}
            <Button asChild variant="outline">
              <Link href="/">Check a new argument</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
