"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

/**
 * Client component that handles authentication tokens from URL hash fragments.
 * This is needed for email confirmation links that redirect with access tokens.
 */
export function AuthHandler() {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const handleAuthHash = async () => {
      // Check if we have auth data in the URL hash
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const type = hashParams.get("type");

      if (accessToken && refreshToken && !isProcessing) {
        setIsProcessing(true);

        try {
          // Set the session with the tokens from the URL
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) {
            console.error("Error setting session:", error);
          }

          // Clean up the URL by removing the hash
          window.history.replaceState(null, "", window.location.pathname);

          // If this was a signup confirmation, show a success message
          if (type === "signup") {
            console.log("Email confirmed successfully");
          }

          // Refresh the page to update auth state
          router.refresh();
        } catch (error) {
          console.error("Error handling auth hash:", error);
        } finally {
          setIsProcessing(false);
        }
      }
    };

    void handleAuthHash();
  }, [router, isProcessing]);

  return null; // This component doesn't render anything
}
