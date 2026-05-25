"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      router.push("/admin");
      router.refresh();
    } else {
      setError("Wrong password.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen-safe bg-gs-surface flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-3xl border border-gs-border p-8 shadow-sm">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-9 h-9 rounded-xl bg-gs-red flex items-center justify-center">
            <span className="text-white font-black">G</span>
          </div>
          <div>
            <p className="font-black text-gs-dark text-sm">Gild Society</p>
            <p className="text-xs text-gs-medium">Admin</p>
          </div>
        </div>

        <h1 className="text-2xl font-black text-gs-dark mb-1">Welcome back</h1>
        <p className="text-gs-medium text-sm mb-6">Enter your admin password to continue.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            autoFocus
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Admin password"
            className="w-full px-4 py-3 rounded-2xl border-2 border-gs-border text-gs-dark font-semibold focus:outline-none focus:border-gs-red transition-colors"
          />

          {error && <p className="text-sm text-destructive">{error}</p>}

          <button
            type="submit"
            disabled={!password || loading}
            className="w-full bg-gs-red text-white font-bold py-3.5 rounded-2xl hover:bg-gs-red-dark transition-colors disabled:opacity-40 disabled:pointer-events-none"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
