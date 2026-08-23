"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { signInAction, type SignInState } from "@/app/actions/admin-auth";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 h-12 w-full rounded-full bg-forest text-sm font-semibold tracking-wide text-cream transition-colors hover:bg-forest-soft disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Signing in…" : "Sign in"}
    </button>
  );
}

export function LoginForm({ next }: { next: string }) {
  const [state, formAction] = useActionState<SignInState, FormData>(
    signInAction,
    {}
  );

  return (
    <form action={formAction} className="mt-8 flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />

      <label className="flex flex-col gap-1.5 text-left">
        <span className="text-xs font-semibold uppercase tracking-widest text-toast">
          Email
        </span>
        <input
          type="email"
          name="email"
          autoComplete="email"
          required
          className="h-12 rounded-xl border border-forest/15 bg-white px-4 text-sm outline-none transition-colors focus:border-forest"
          placeholder="you@ttbrothers.test"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-left">
        <span className="text-xs font-semibold uppercase tracking-widest text-toast">
          Password
        </span>
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          required
          className="h-12 rounded-xl border border-forest/15 bg-white px-4 text-sm outline-none transition-colors focus:border-forest"
          placeholder="••••••••"
        />
      </label>

      {state.error ? (
        <p
          role="alert"
          className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {state.error}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}
