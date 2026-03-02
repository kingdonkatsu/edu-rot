import { describe, it, expect } from 'vitest';
import {
  MockVideoAssemblyService,
  hasAzureVideoAssemblyConfig,
} from '../../src/services/video-assembly.js';
import { MockTTSService } from '../../src/adapters/azure-tts.js';
import { createMediaHandlers } from '../../src/handlers/media.js';

function mockResponse() {
  let statusCode = 200;
  let payload: unknown;
  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(data: unknown) {
      payload = data;
      return this;
    },
  };

  return {
    res,
    get statusCode() {
      return statusCode;
    },
    get payload() {
      return payload;
    },
  };
}

describe('MockVideoAssemblyService', () => {
  it('returns mock video output', async () => {
    const service = new MockVideoAssemblyService();
    const result = await service.assemble({
      audio_url: 'https://mock.blob.local/mock/audio/test.mp3',
      background_key: 'algebra',
      output_basename: 'test-output',
    });

    expect(result.video_url).toContain('mock.blob.local');
    expect(result.duration_seconds).toBe(60);
    expect(result.blob_path.endsWith('.mp4')).toBe(true);
  });

  it('detects required config', () => {
    expect(hasAzureVideoAssemblyConfig({})).toBe(false);
    expect(
      hasAzureVideoAssemblyConfig({
        AZURE_BLOB_CONNECTION_STRING: 'conn',
        AZURE_BLOB_CONTAINER_VIDEO: 'video',
        AZURE_BLOB_CONTAINER_OUTPUT: 'output',
      })
    ).toBe(true);
  });
});

describe('media handler video endpoints', () => {
  it('validates required request fields for /media/video', async () => {
    const handlers = createMediaHandlers(new MockTTSService(), new MockVideoAssemblyService());
    const response = mockResponse();
    await handlers.postVideo({ body: { audio_url: 'x' } } as never, response.res as never);
    expect(response.statusCode).toBe(400);
  });

  it('orchestrates crash-course -> tts -> video pipeline', async () => {
    const handlers = createMediaHandlers(new MockTTSService(), new MockVideoAssemblyService());
    const response = mockResponse();

    await handlers.postCrashCourseVideo(
      {
        body: {
          student_id: 'student-1',
          topic: 'Algebra',
          subtopic: 'Quadratic equations',
          error_classification: 'lucky_guess',
          mastery_level: 'novice',
          known_strengths: ['arithmetic'],
          rag: {
            concept_explanations: ['Quadratic equations have a standard form and predictable solving paths.'],
            misconception_data: ['lucky_guess leads to skipped verification steps.'],
            analogies: ['It is like choosing the right path in a split road.'],
            worked_examples: ['Factor x squared minus five x plus six into two linear terms.'],
          },
        },
      } as never,
      response.res as never
    );

    expect(response.statusCode).toBe(200);
    const payload = response.payload as Record<string, unknown>;
    expect(payload.script).toBeDefined();
    expect(payload.audio).toBeDefined();
    expect(payload.video).toBeDefined();
  });

  it('falls back to mock video assembly when tts returns mock audio URL', async () => {
    const handlers = createMediaHandlers(new MockTTSService(), {
      async assemble(request) {
        if (request.audio_url.startsWith('https://mock.')) {
          throw new Error('Cannot fetch mock audio URL');
        }
        return { video_url: 'https://real.blob.local/video.mp4', duration_seconds: 60, blob_path: 'video.mp4' };
      },
    });
    const response = mockResponse();

    await handlers.postCrashCourseVideo(
      {
        body: {
          student_id: 'student-1',
          topic: 'Algebra',
          subtopic: 'Quadratic equations',
          error_classification: 'lucky_guess',
          mastery_level: 'novice',
          known_strengths: ['arithmetic'],
          rag: {
            concept_explanations: ['Quadratic equations have a standard form and predictable solving paths.'],
            misconception_data: ['lucky_guess leads to skipped verification steps.'],
            analogies: ['It is like choosing the right path in a split road.'],
            worked_examples: ['Factor x squared minus five x plus six into two linear terms.'],
          },
        },
      } as never,
      response.res as never
    );

    expect(response.statusCode).toBe(200);
    const payload = response.payload as { video: { video_url: string } };
    expect(payload.video.video_url).toContain('mock.blob.local');
  });
});
