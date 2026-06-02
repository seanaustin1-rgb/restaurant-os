import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { functions } from "@/lib/inngest/functions";

// Inngest calls this endpoint to register and invoke functions.
// It is authenticated by the Inngest signing key (not Clerk) — see middleware.
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions,
});
