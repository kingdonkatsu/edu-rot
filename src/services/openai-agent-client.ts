import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_OPENAI_MODEL = 'gpt-4.1-mini';
const DEFAULT_OPENAI_API_BASE = 'https://api.openai.com/v1';
let envLoaded = false;

export class AgentConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AgentConfigError';
  }
}

export class OpenAIRequestError extends Error {
  readonly status: number;
  readonly body: string;

  constructor(status: number, body: string) {
    super(`OpenAI request failed with status ${status}`);
    this.name = 'OpenAIRequestError';
    this.status = status;
    this.body = body;
  }
}

export interface OpenAIJsonRequest {
  system: string;
  user: string;
  model?: string;
  temperature?: number;
}

export function loadLocalEnv(): void {
  if (envLoaded) {
    return;
  }

  const cwd = process.cwd();
  // Match common precedence: base first, then local override.
  const files = ['.env', '.env.local'];
  files.forEach((file) => {
    const fullPath = path.join(cwd, file);
    if (!fs.existsSync(fullPath)) {
      return;
    }
    const content = fs.readFileSync(fullPath, 'utf8');
    parseEnvContent(content);
  });

  envLoaded = true;
}

export function isOpenAIConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim().length > 0);
}

export async function callOpenAIJson<T>(request: OpenAIJsonRequest): Promise<T> {
  loadLocalEnv();
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new AgentConfigError('OPENAI_API_KEY is missing. Add it to .env before running LLM-backed agents.');
  }

  const model = request.model ?? process.env.OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL;
  const apiBase = process.env.OPENAI_API_BASE_URL ?? DEFAULT_OPENAI_API_BASE;
  const response = await fetch(`${apiBase}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: request.system },
        { role: 'user', content: request.user },
      ],
      temperature: request.temperature ?? 0.2,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new OpenAIRequestError(response.status, text);
  }

  const payload = (await response.json()) as ChatCompletionResponse;
  const content = extractMessageContent(payload.choices?.[0]?.message?.content);
  if (!content) {
    throw new OpenAIRequestError(500, 'OpenAI response did not contain message content');
  }

  const jsonText = extractJsonObject(content);
  return JSON.parse(jsonText) as T;
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
}

function parseEnvContent(content: string): void {
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      return;
    }
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex < 1) {
      return;
    }
    const key = trimmed.slice(0, eqIndex).trim();
    const rawValue = trimmed.slice(eqIndex + 1).trim();
    const value = stripQuotes(rawValue);

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  });
}

function stripQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith('\'') && value.endsWith('\''))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function extractMessageContent(
  content: string | Array<{ type?: string; text?: string }> | undefined
): string {
  if (!content) {
    return '';
  }
  if (typeof content === 'string') {
    return content;
  }
  return content
    .map((part) => part.text ?? '')
    .join('\n')
    .trim();
}

function extractJsonObject(content: string): string {
  const trimmed = content.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed;
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced && fenced[1]) {
    return fenced[1].trim();
  }

  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first >= 0 && last > first) {
    return trimmed.slice(first, last + 1);
  }
  return trimmed;
}
