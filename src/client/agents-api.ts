import type {
  CrashCourseAgentInput,
  CrashCourseAgentOutput,
  WeeklyLearningState,
  WeeklyInsightsAgentOutput,
} from '../types.js';

export interface AgentsApiOptions {
  baseUrl: string;
  timeoutMs?: number;
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function postCrashCourse(
  input: CrashCourseAgentInput,
  opts: AgentsApiOptions
): Promise<CrashCourseAgentOutput> {
  const timeout = opts.timeoutMs ?? 10_000;
  const res = await fetchWithTimeout(
    `${opts.baseUrl}/api/v1/agents/crash-course`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
    timeout
  );
  if (!res.ok) {
    throw new Error(`crash-course agent failed: ${res.status}`);
  }
  return res.json() as Promise<CrashCourseAgentOutput>;
}

export async function postWeeklyInsights(
  input: WeeklyLearningState,
  opts: AgentsApiOptions
): Promise<WeeklyInsightsAgentOutput> {
  const timeout = opts.timeoutMs ?? 10_000;
  const res = await fetchWithTimeout(
    `${opts.baseUrl}/api/v1/agents/weekly-insights`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
    timeout
  );
  if (!res.ok) {
    throw new Error(`weekly-insights agent failed: ${res.status}`);
  }
  return res.json() as Promise<WeeklyInsightsAgentOutput>;
}

