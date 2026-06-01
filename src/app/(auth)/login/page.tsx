"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Building2, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);

    const result = await signIn("credentials", {
      email: form.get("email"),
      password: form.get("password"),
      redirect: false,
    });

    setLoading(false);
    if (result?.error) {
      toast.error("Invalid email or password");
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  return (
    <div className="grid w-full max-w-5xl overflow-hidden rounded-lg border bg-card shadow-xl md:grid-cols-[1fr_1.05fr]">
      <div className="hidden border-r bg-muted/40 p-8 md:flex md:flex-col md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg border bg-card text-primary shadow-sm">
              <span className="font-heading text-2xl font-semibold leading-none">G</span>
            </span>
            <div>
              <p className="font-heading text-3xl font-semibold leading-none">GHM</p>
              <p className="mt-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Property Office
              </p>
            </div>
          </div>

          <div className="mt-16 space-y-4">
            <p className="page-kicker">Private workspace</p>
            <h1 className="font-heading text-5xl font-semibold leading-[0.95]">
              A calmer way to manage every door.
            </h1>
            <p className="max-w-sm text-sm leading-6 text-muted-foreground">
              Review rent, maintenance, leases, applications, documents, and tenant communication from one focused office.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <LockKeyhole className="h-4 w-4 text-primary" />
          Organization-scoped access
        </div>
      </div>

      <Card className="border-0 shadow-none">
        <CardHeader className="space-y-4 px-6 pb-2 pt-8 text-center md:px-10 md:pt-12">
          <div className="flex justify-center md:hidden">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg border bg-card text-primary shadow-sm">
              <Building2 className="h-6 w-6" />
            </div>
          </div>
          <div>
            <CardTitle className="font-heading text-4xl">Welcome back</CardTitle>
            <CardDescription className="mt-2">Sign in to your GHM account</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="px-6 pb-8 md:px-10 md:pb-12">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" placeholder="you@example.com" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" placeholder="********" required />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>
          <p className="mt-5 text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="font-medium text-primary hover:underline">
              Sign up
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
