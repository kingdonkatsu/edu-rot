import { describe, it, expect } from 'vitest';
import { MockTTSService, hasAzureTTSConfig } from '../../src/adapters/azure-tts.js';
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

describe('MockTTSService', () => {
  it('synthesizes plain script text', async () => {
    const service = new MockTTSService();
    const result = await service.synthesize({ script: 'This is a short script for testing output duration.' });
    expect(result.audio_url).toContain('mock.blob.local');
    expect(result.duration_seconds).toBeGreaterThan(0);
    expect(result.blob_path.endsWith('.mp3')).toBe(true);
  });

  it('detects required Azure config', () => {
    expect(hasAzureTTSConfig({})).toBe(false);
    expect(
      hasAzureTTSConfig({
        AZURE_SPEECH_KEY: 'k',
        AZURE_SPEECH_REGION: 'r',
        AZURE_BLOB_CONNECTION_STRING: 'c',
        AZURE_BLOB_CONTAINER_AUDIO: 'audio',
      })
    ).toBe(true);
  });
});

describe('media handler TTS endpoint', () => {
  it('returns 400 when script is missing', async () => {
    const handlers = createMediaHandlers(new MockTTSService(), {
      async assemble() {
        return { video_url: 'mock', duration_seconds: 60, blob_path: 'mock' };
      },
    });

    const response = mockResponse();
    await handlers.postTTS({ body: {} } as never, response.res as never);

    expect(response.statusCode).toBe(400);
  });

  it('returns 200 and tts payload when request is valid', async () => {
    const handlers = createMediaHandlers(new MockTTSService(), {
      async assemble() {
        return { video_url: 'mock', duration_seconds: 60, blob_path: 'mock' };
      },
    });

    const response = mockResponse();
    await handlers.postTTS({ body: { script: 'Voiceover test text' } } as never, response.res as never);

    expect(response.statusCode).toBe(200);
    const payload = response.payload as Record<string, unknown>;
    expect(typeof payload.audio_url).toBe('string');
  });
});
