import type {
  CrashCourseAgentInput,
  CrashCourseVideoPreference,
  CrashCourseVideoRenderRequest,
  CrashCourseVideoRenderResponse,
  VideoJobStatus,
  VideoStylePreset,
} from '../types.js';
import {
  AgentConfigError,
  OpenAIRequestError,
  isOpenAIConfigured,
  loadLocalEnv,
} from './openai-agent-client.js';
import { runCrashCourseAgent } from './crash-course-agent.js';

const DEFAULT_SORA_MODEL = 'sora-2';
const DEFAULT_OPENAI_API_BASE = 'https://api.openai.com/v1';
const DEFAULT_STYLE_PRESET: VideoStylePreset = 'brainrot_classic';
const DEFAULT_SECONDS = '8';
const DEFAULT_SIZE = '720x1280';

const STYLE_PRESET_MAP: Record<VideoStylePreset, string> = {
  brainrot_classic:
    'High-energy educational brainrot short. Bold captions, playful pacing, clear concept transitions.',
  cartoon_ocean_mentor:
    'Original undersea cartoon teacher vibe, bright aquatic classroom visuals, friendly educational comedy.',
  anime_sensei:
    'Anime-inspired study coach style, dynamic motion lines, energetic but clear teaching voice.',
  retro_arcade_coach:
    'Retro arcade classroom aesthetic, pixel overlays, combo/streak gamified teaching cues.',
  chalkboard_speedrun:
    'Fast chalkboard explainer style with hand-drawn notes, quick but clear instructional pacing.',
};

const COPYRIGHT_SENSITIVE_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\bspongebob\b/gi, replacement: 'original undersea cartoon mentor' },
  { pattern: /\bpatrick star\b/gi, replacement: 'original starfish classmate character' },
  { pattern: /\bpaw patrol\b/gi, replacement: 'original rescue-team cartoon style' },
  { pattern: /\bmarvel\b/gi, replacement: 'original superhero-style training montage' },
  { pattern: /\bdisney\b/gi, replacement: 'original family-friendly animation style' },
];

export async function createCrashCourseVideoRender(
  request: CrashCourseVideoRenderRequest
): Promise<CrashCourseVideoRenderResponse> {
  loadLocalEnv();
  if (!isOpenAIConfigured()) {
    throw new AgentConfigError('OPENAI_API_KEY is missing for video rendering runtime.');
  }

  const crashCourse = await runCrashCourseAgent(request.crash_course_input);
  const preference = normalizePreference(request.video_preference);
  const promptBuild = buildRenderedPrompt(
    request.crash_course_input,
    crashCourse.sora_video_prompt,
    preference
  );
  const initialJob = await createVideoJob(promptBuild.prompt, preference);

  const autoPoll = Boolean(request.auto_poll);
  if (!autoPoll) {
    return {
      crash_course: crashCourse,
      rendered_prompt: promptBuild.prompt,
      style_preset: preference.style_preset,
      safety_note: promptBuild.note,
      video_job: initialJob,
      content_url: initialJob.status === 'completed'
        ? `/api/v1/videos/${initialJob.id}/content`
        : undefined,
    };
  }

  const finalJob = await pollVideoUntilTerminal(
    initialJob.id,
    request.poll_interval_ms ?? 2500,
    request.max_wait_ms ?? 90_000
  );

  return {
    crash_course: crashCourse,
    rendered_prompt: promptBuild.prompt,
    style_preset: preference.style_preset,
    safety_note: promptBuild.note,
    video_job: finalJob,
    content_url: finalJob.status === 'completed'
      ? `/api/v1/videos/${finalJob.id}/content`
      : undefined,
  };
}

export async function getVideoJobStatus(videoId: string): Promise<VideoJobStatus> {
  const payload = await openAIJsonRequest(`/videos/${videoId}`, { method: 'GET' });
  return sanitizeVideoStatus(payload);
}

export async function getVideoContentBuffer(videoId: string): Promise<{
  contentType: string;
  data: Buffer;
}> {
  loadLocalEnv();
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new AgentConfigError('OPENAI_API_KEY is missing for video rendering runtime.');
  }
  const apiBase = process.env.OPENAI_API_BASE_URL ?? DEFAULT_OPENAI_API_BASE;
  const response = await fetch(`${apiBase}/videos/${videoId}/content`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new OpenAIRequestError(response.status, text);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get('content-type') ?? 'video/mp4';
  return { contentType, data: buffer };
}

function normalizePreference(preference: CrashCourseVideoPreference | undefined): Required<CrashCourseVideoPreference> {
  return {
    style_preset: preference?.style_preset ?? DEFAULT_STYLE_PRESET,
    creator_prompt: preference?.creator_prompt ?? '',
    voiceover_style: preference?.voiceover_style ?? 'friendly energetic tutor',
    seconds: preference?.seconds ?? DEFAULT_SECONDS,
    size: preference?.size ?? DEFAULT_SIZE,
  };
}

function buildRenderedPrompt(
  input: CrashCourseAgentInput,
  soraPrompt: NonNullable<Awaited<ReturnType<typeof runCrashCourseAgent>>['sora_video_prompt']>,
  preference: Required<CrashCourseVideoPreference>
): { prompt: string; note?: string } {
  const styleBase = STYLE_PRESET_MAP[preference.style_preset];
  const sanitizedCreator = sanitizeCreatorPrompt(preference.creator_prompt);

  const sceneLines = soraPrompt.scenes
    .map((scene, index) =>
      `Scene ${index + 1} (${scene.stage}): goal=${scene.scene_goal}; visual=${scene.on_screen_visual}; narration=${scene.narration_prompt}; misconception=${scene.misconception_target}.`
    )
    .join('\n');

  const prompt = [
    `Create a ${preference.seconds}-second ${preference.size} vertical educational short.`,
    `Topic: ${input.topic} / ${input.subtopic}.`,
    `Audience: ${soraPrompt.audience}.`,
    `Style preset: ${preference.style_preset}. ${styleBase}`,
    `Voiceover style: ${preference.voiceover_style}.`,
    sanitizedCreator.prompt ? `Custom creator preference: ${sanitizedCreator.prompt}` : '',
    `Safety constraints: ${soraPrompt.safety_constraints.join(' | ')}.`,
    `Video objective: ${soraPrompt.video_objective}.`,
    sceneLines,
    `Final call to action: ${soraPrompt.final_call_to_action}.`,
    'No copyrighted characters or logos. Keep content educational, accurate, and learner-safe.',
  ].filter(Boolean).join('\n');

  return { prompt, note: sanitizedCreator.note };
}

function sanitizeCreatorPrompt(input: string): { prompt: string; note?: string } {
  let prompt = input.trim();
  if (!prompt) {
    return { prompt: '' };
  }

  const notes: string[] = [];
  COPYRIGHT_SENSITIVE_PATTERNS.forEach(({ pattern, replacement }) => {
    if (pattern.test(prompt)) {
      prompt = prompt.replace(pattern, replacement);
      notes.push('Replaced copyrighted character/style reference with an original style-safe description.');
    }
  });

  return {
    prompt,
    note: notes.length > 0 ? notes.join(' ') : undefined,
  };
}

async function createVideoJob(
  prompt: string,
  preference: Required<CrashCourseVideoPreference>
): Promise<VideoJobStatus> {
  loadLocalEnv();
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new AgentConfigError('OPENAI_API_KEY is missing for video rendering runtime.');
  }

  const apiBase = process.env.OPENAI_API_BASE_URL ?? DEFAULT_OPENAI_API_BASE;
  const model = process.env.SORA_MODEL ?? DEFAULT_SORA_MODEL;
  const form = new FormData();
  form.append('model', model);
  form.append('prompt', prompt);
  form.append('seconds', preference.seconds);
  form.append('size', preference.size);

  const response = await fetch(`${apiBase}/videos`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new OpenAIRequestError(response.status, text);
  }

  const payload = await response.json();
  return sanitizeVideoStatus(payload);
}

async function pollVideoUntilTerminal(
  videoId: string,
  intervalMs: number,
  maxWaitMs: number
): Promise<VideoJobStatus> {
  const start = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const status = await getVideoJobStatus(videoId);
    if (isTerminalStatus(status.status)) {
      return status;
    }
    if (Date.now() - start > maxWaitMs) {
      return status;
    }
    await sleep(intervalMs);
  }
}

function isTerminalStatus(status: string): boolean {
  return status === 'completed' || status === 'failed' || status === 'cancelled';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function openAIJsonRequest(
  path: string,
  init: { method: 'GET' | 'DELETE' }
): Promise<unknown> {
  loadLocalEnv();
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new AgentConfigError('OPENAI_API_KEY is missing for video rendering runtime.');
  }
  const apiBase = process.env.OPENAI_API_BASE_URL ?? DEFAULT_OPENAI_API_BASE;
  const response = await fetch(`${apiBase}${path}`, {
    method: init.method,
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new OpenAIRequestError(response.status, text);
  }
  return response.json();
}

function sanitizeVideoStatus(payload: unknown): VideoJobStatus {
  const obj = (payload && typeof payload === 'object') ? payload as Record<string, unknown> : {};
  const maybeError = obj.error && typeof obj.error === 'object' ? obj.error as Record<string, unknown> : null;
  return {
    id: typeof obj.id === 'string' ? obj.id : '',
    status: typeof obj.status === 'string' ? obj.status : 'unknown',
    progress: typeof obj.progress === 'number' ? obj.progress : undefined,
    model: typeof obj.model === 'string' ? obj.model : undefined,
    size: typeof obj.size === 'string' ? obj.size : undefined,
    seconds: typeof obj.seconds === 'string' ? obj.seconds : undefined,
    error: maybeError
      ? {
        code: typeof maybeError.code === 'string' ? maybeError.code : undefined,
        message: typeof maybeError.message === 'string' ? maybeError.message : undefined,
      }
      : null,
  };
}
