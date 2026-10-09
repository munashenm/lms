export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startInProcessScheduler } = await import("@/lib/scheduler/run");
  startInProcessScheduler();
}
