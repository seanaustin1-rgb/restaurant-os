"use client";

import { useAuth } from "@clerk/nextjs";
import { CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { acceptAccessInvite } from "@/app/settings/access/actions";

export function AcceptBusinessInviteButton({ token }: { token: string }) {
  const { getToken } = useAuth();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function accept(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const destination = await acceptAccessInvite(token);
      await getToken({ skipCache: true });
      router.replace(destination);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not accept this invite. Try again.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={accept} className="space-y-2">
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-md border border-copper-dim bg-copper/10 px-4 py-2 text-sm text-copper-soft hover:bg-copper/20 disabled:opacity-60"
      >
        <CheckCircle2 size={15} /> {pending ? "Accepting…" : "Accept access"}
      </button>
      {error && <p role="alert" className="text-sm text-health-red">{error}</p>}
    </form>
  );
}
