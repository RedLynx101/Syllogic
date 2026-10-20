import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { STATEMENT_FORMS } from "@/lib/format";
import { EXAMPLES, type ExampleArgument } from "@/lib/examples";
import { Sparkles } from "lucide-react";

interface HowItWorksProps {
  onLoadExample: (example: ExampleArgument) => void;
  disabled?: boolean;
}

/** First-run guide: the four statement forms, one-click examples and the rule set. */
export function HowItWorks({ onLoadExample, disabled }: HowItWorksProps) {
  return (
    <Card>
      <CardHeader className="space-y-1.5 pb-4">
        <h2 className="text-lg font-semibold leading-tight">How it works</h2>
        <p className="text-sm text-muted-foreground">
          Write two or more premises and the conclusion you want to test. Syllogic tries to derive the
          conclusion and lists every step it used.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <section aria-labelledby="examples-heading" className="space-y-2">
          <h3 id="examples-heading" className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
            Try an example
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {EXAMPLES.map((example) => (
              <Button
                key={example.id}
                type="button"
                variant="outline"
                onClick={() => onLoadExample(example)}
                disabled={disabled}
                className="h-auto flex-col items-start justify-start gap-0.5 whitespace-normal px-3 py-2 text-left"
                aria-label={`Load the ${example.name} example and evaluate it`}
              >
                <span className="font-semibold">{example.name}</span>
                <span className="hidden text-xs font-normal text-muted-foreground sm:block">{example.summary}</span>
              </Button>
            ))}
          </div>
        </section>

        <section aria-labelledby="forms-heading" className="space-y-2">
          <h3 id="forms-heading" className="text-sm font-semibold">
            The four statement forms
          </h3>
          <dl className="grid grid-cols-2 gap-2">
            {STATEMENT_FORMS.map(({ form, pattern, name }) => (
              <div key={form} className="flex items-baseline gap-2 rounded-md border bg-muted/30 px-3 py-2">
                <dt className="font-mono text-sm font-bold">{form}</dt>
                <dd className="min-w-0">
                  <span className="block text-sm font-medium">{pattern}</span>
                  <span className="hidden text-xs text-muted-foreground sm:block">{name}</span>
                </dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-muted-foreground">
            Press <span className="rounded border bg-background px-1 font-mono">non-</span> beside a term to use
            its complement, so <em>mortal</em> becomes <em>non-mortal</em>.
          </p>
        </section>

        <section aria-labelledby="rules-heading" className="space-y-1.5">
          <h3 id="rules-heading" className="text-sm font-semibold">
            Rules it knows
          </h3>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Barbara and Darii, plus three immediate inferences: obversion, conversion (E and I) and
            contraposition (A and O). That covers the 15 moods that are valid without existential import.
            Moods that rely on existential import, such as Darapti, are reported invalid, and “invalid” means
            the conclusion cannot be derived with these rules.
          </p>
        </section>
      </CardContent>
    </Card>
  );
}
