import { useEffect } from "react";

/** Sets the browser tab title to "<title> · Syllogic" while the calling page is shown. */
export function useDocumentTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} · Syllogic` : "Syllogic";
  }, [title]);
}
