"use client";

import { useAuth } from "@/contexts/auth-context";

export function AuthHeader() {
  const { user, loading, signOut } = useAuth();

  if (loading) {
    return (
      <header className="border-b p-4">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold">Proposal Utility Suite</h1>
          <div className="text-sm text-gray-500">Loading...</div>
        </div>
      </header>
    );
  }

  return (
    <header className="border-b p-4">
      <div className="container mx-auto flex justify-between items-center">
        <h1 className="text-xl font-bold">Proposal Utility Suite</h1>
        {user ? (
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user.email}</span>
            <button
              onClick={() => signOut()}
              className="text-sm px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded"
            >
              Sign Out
            </button>
          </div>
        ) : (
          <a
            href="/auth/sign-in"
            className="text-sm px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
          >
            Sign In
          </a>
        )}
      </div>
    </header>
  );
}
