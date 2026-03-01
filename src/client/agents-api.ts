import type {
  CrashCourseAgentInput,
  CrashCourseAgentOutput,
  CrashCourseVideoRenderRequest,
  CrashCourseVideoRenderResponse,
  VideoJobStatus,
  WeeklyInsightsAgentOutput,
  WeeklyLearningState,
} from '../types.js';

const CRASH_COURSE_PATH = '/api/v1/agents/crash-course';
const WEEKLY_INSIGHTS_PATH = '/api/v1/agents/weekly-insights';
const CRASH_COURSE_VIDEO_PATH = '/api/v1/videos/crash-course';

export interface AgentApiRequestOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export class AgentApiHttpError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, body: unknown) {
    super(`Agent API request failed with status ${status}`);
    this.name = 'AgentApiHttpError';
    this.status = status;
    this.body = body;
  }
}

export async function postCrashCourseAgent(
  input: CrashCourseAgentInput,
  options: AgentApiRequestOptions = {}
): Promise<CrashCourseAgentOutput> {
  return postJson<CrashCourseAgentOutput>(CRASH_COURSE_PATH, input, options);
}

export async function postWeeklyInsightsAgent(
  input: WeeklyLearningState,
  options: AgentApiRequestOptions = {}
): Promise<WeeklyInsightsAgentOutput> {
  return postJson<WeeklyInsightsAgentOutput>(WEEKLY_INSIGHTS_PATH, input, options);
}

export async function postCrashCourseVideoRender(
  input: CrashCourseVideoRenderRequest,
  options: AgentApiRequestOptions = {}
): Promise<CrashCourseVideoRenderResponse> {
  return postJson<CrashCourseVideoRenderResponse>(CRASH_COURSE_VIDEO_PATH, input, options);
}

export async function getVideoJobStatus(
  videoId: string,
  options: AgentApiRequestOptions = {}
): Promise<VideoJobStatus> {
  return getJson<VideoJobStatus>(`/api/v1/videos/${encodeURIComponent(videoId)}`, options);
}

async function postJson<TResponse>(
  path: string,
  payload: unknown,
  options: AgentApiRequestOptions
): Promise<TResponse> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(resolveUrl(options.baseUrl, path), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    body: JSON.stringify(payload),
    signal: options.signal,
  });

  const responseBody = await parseJsonResponse(response);
  if (!response.ok) {
    throw new AgentApiHttpError(response.status, responseBody);
  }
  return responseBody as TResponse;
}

async function getJson<TResponse>(
  path: string,
  options: AgentApiRequestOptions
): Promise<TResponse> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(resolveUrl(options.baseUrl, path), {
    method: 'GET',
    headers: {
      ...options.headers,
    },
    signal: options.signal,
  });

  const responseBody = await parseJsonResponse(response);
  if (!response.ok) {
    throw new AgentApiHttpError(response.status, responseBody);
  }
  return responseBody as TResponse;
}

function resolveUrl(baseUrl: string | undefined, path: string): string {
  if (!baseUrl) {
    return path;
  }
  return `${baseUrl.replace(/\/+$/g, '')}${path}`;
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
