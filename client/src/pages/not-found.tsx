import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Compass } from "lucide-react";
import { Link } from "wouter";
import { useDocumentTitle } from "@/hooks/use-document-title";

export default function NotFound() {
  useDocumentTitle("Page not found");
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="mx-4 w-full max-w-md">
        <CardContent className="pt-8">
          <div className="flex flex-col items-center text-center">
            <Compass className="mb-4 h-10 w-10 text-muted-foreground" aria-hidden="true" />
            <p className="font-mono text-sm text-muted-foreground">404</p>
            <h1 className="mt-1 text-2xl font-bold">Page not found</h1>
            <p className="mt-2 text-muted-foreground">There is nothing at this address.</p>
          </div>
        </CardContent>
        <CardFooter className="flex justify-center pb-8">
          <Button asChild>
            <Link href="/">Check an argument</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
