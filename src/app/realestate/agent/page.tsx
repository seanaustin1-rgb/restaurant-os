import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { loadAgentApp } from "@/lib/realestate/load-agent-app";
import { AgentAppView } from "./AgentAppView";

// The agent app (Today + Live). Resolves the signed-in user to their
// BrokerageAgent via clerkUserId. Users not linked to an agent fall back to
// /dashboard.
export default async function AgentAppPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const agent = await prisma.brokerageAgent.findFirst({
    where: { clerkUserId: userId },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  if (!agent) redirect("/dashboard");

  const data = await loadAgentApp(agent.id);
  if (!data) redirect("/dashboard");

  return <AgentAppView data={data} />;
}
