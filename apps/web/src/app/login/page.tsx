"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";

type LoginResponse = {
  accessToken: string;
  tokenType: string;
  user: {
    id: string;
    username: string;
    email: string;
    firstName: string;
    lastName: string;
    roles: string[];
  };
};

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await apiRequest<LoginResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ identifier, password }),
      });

      sessionStorage.setItem("epsu_access_token", result.accessToken);
      sessionStorage.setItem("epsu_user", JSON.stringify(result.user));
      router.push("/");
    } catch {
      setError("Login failed. Check your username or email and password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand">
          <div className="brand-logo">E</div>
          <div>
            <strong>EPSU</strong>
            <span>Clearance Portal</span>
          </div>
        </div>

        <p className="eyebrow">ETHIOPIAN PUBLIC SERVICE UNIVERSITY</p>
        <h1>Welcome back</h1>
        <p className="login-description">
          Sign in to manage and track your student clearance.
        </p>

        <form onSubmit={handleSubmit} className="login-form">
          <label htmlFor="identifier">Username or email</label>
          <input
            id="identifier"
            name="identifier"
            autoComplete="username"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            required
            minLength={3}
            placeholder="Enter your username or email"
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={8}
            placeholder="Enter your password"
          />

          {error && <p className="login-error" role="alert">{error}</p>}

          <button className="primary-button login-submit" type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="login-footer">
          Student Clearance Management System
        </p>
      </section>
    </main>
  );
}
