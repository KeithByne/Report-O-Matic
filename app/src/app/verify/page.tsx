import { Suspense } from "react";
import { VerifyForm } from "./VerifyForm";

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6 text-zinc-600 text-sm">
          Loading…
        </div>
      }
    >
      <VerifyForm />
    </Suspense>
  );
}
