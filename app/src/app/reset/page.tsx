import { Suspense } from "react";
import { ResetForm } from "./ResetForm";

export default function ResetPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-emerald-50/80 flex items-center justify-center p-6 text-zinc-600 text-sm">
          Loading…
        </div>
      }
    >
      <ResetForm />
    </Suspense>
  );
}

