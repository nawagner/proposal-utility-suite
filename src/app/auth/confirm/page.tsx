"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import Link from "next/link";

export default function ConfirmPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    const handleEmailConfirmation = async () => {
      try {
        // Check for hash-based auth tokens (email confirmation)
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        const type = hashParams.get("type");

        if (accessToken && refreshToken) {
          // Set the session with tokens from URL
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) {
            throw error;
          }

          // Clean up the URL
          window.history.replaceState(null, "", window.location.pathname);

          setStatus("success");

          // Redirect to home after a brief delay
          setTimeout(() => {
            router.push("/");
          }, 2000);
        } else {
          // Check for code-based auth (PKCE flow)
          const params = new URLSearchParams(window.location.search);
          const code = params.get("code");

          if (code) {
            const { error } = await supabase.auth.exchangeCodeForSession(code);

            if (error) {
              throw error;
            }

            setStatus("success");
            setTimeout(() => {
              router.push("/");
            }, 2000);
          } else {
            // No auth data found
            setErrorMessage("No confirmation data found in URL");
            setStatus("error");
          }
        }
      } catch (error) {
        console.error("Error confirming email:", error);
        setErrorMessage(error instanceof Error ? error.message : "Unknown error occurred");
        setStatus("error");
      }
    };

    void handleEmailConfirmation();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100">
      <div className="w-full max-w-md">
        <div className="bg-white p-8 rounded-lg shadow-md text-center">
          {status === "processing" && (
            <>
              <div className="mb-4">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
              </div>
              <h1 className="text-2xl font-bold text-slate-900 mb-2">
                Confirming your email...
              </h1>
              <p className="text-slate-600">Please wait while we verify your account.</p>
            </>
          )}

          {status === "success" && (
            <>
              <div className="mb-4">
                <svg
                  className="inline-block h-16 w-16 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-slate-900 mb-2">
                Email confirmed!
              </h1>
              <p className="text-slate-600 mb-6">
                Your account has been successfully verified. Redirecting you to the app...
              </p>
              <Link
                href="/"
                className="inline-block text-blue-600 hover:text-blue-700 font-medium"
              >
                Continue to app →
              </Link>
            </>
          )}

          {status === "error" && (
            <>
              <div className="mb-4">
                <svg
                  className="inline-block h-16 w-16 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-slate-900 mb-2">
                Confirmation failed
              </h1>
              <p className="text-slate-600 mb-6">
                {errorMessage || "Unable to confirm your email. The link may have expired."}
              </p>
              <div className="space-x-4">
                <Link
                  href="/auth/sign-in"
                  className="inline-block px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
                >
                  Try signing in
                </Link>
                <Link
                  href="/"
                  className="inline-block px-6 py-2 border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 font-medium"
                >
                  Go home
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
