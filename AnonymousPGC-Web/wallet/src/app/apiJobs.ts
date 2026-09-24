import { api, type ApiJob } from "@shared/api";

export async function pollApiJob<T = unknown>(
  id: string,
  onJob: (job: ApiJob<T>) => void,
  intervalMs = 1000,
) {
  for (;;) {
    const job = await api.job<T>(id);
    onJob(job);

    if (job.status === "succeeded") return job;
    if (job.status === "failed") {
      throw new Error(job.error || `${job.type} failed`);
    }

    await new Promise((resolve) => window.setTimeout(resolve, intervalMs));
  }
}

export function stepFromProgress(progress: number, stepCount: number) {
  if (progress >= 100) return stepCount;
  return Math.max(0, Math.min(stepCount - 1, Math.floor((progress / 100) * stepCount)));
}
