import { BlobServiceClient } from '@azure/storage-blob';
import * as sdk from 'microsoft-cognitiveservices-speech-sdk';
import type { TTSRequest, TTSResult, VoiceoverScript } from '../types.js';

export interface ITTSService {
  synthesize(request: TTSRequest): Promise<TTSResult>;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'voiceover';
}

function extractScriptText(script: string | VoiceoverScript): string {
  return typeof script === 'string' ? script : script.full_script;
}

function estimateDurationSeconds(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 2.5));
}

export class AzureTTSService implements ITTSService {
  private readonly speechKey: string;
  private readonly speechRegion: string;
  private readonly speechVoice: string;
  private readonly blobConnectionString: string;
  private readonly blobContainerAudio: string;

  constructor(opts?: {
    speechKey?: string;
    speechRegion?: string;
    speechVoice?: string;
    blobConnectionString?: string;
    blobContainerAudio?: string;
  }) {
    this.speechKey = opts?.speechKey ?? process.env.AZURE_SPEECH_KEY ?? '';
    this.speechRegion = opts?.speechRegion ?? process.env.AZURE_SPEECH_REGION ?? '';
    this.speechVoice = opts?.speechVoice ?? process.env.AZURE_SPEECH_VOICE ?? 'en-US-JennyNeural';
    this.blobConnectionString = opts?.blobConnectionString ?? process.env.AZURE_BLOB_CONNECTION_STRING ?? '';
    this.blobContainerAudio = opts?.blobContainerAudio ?? process.env.AZURE_BLOB_CONTAINER_AUDIO ?? '';

    if (!this.speechKey || !this.speechRegion || !this.blobConnectionString || !this.blobContainerAudio) {
      throw new Error('AzureTTSService missing required Azure Speech/Blob configuration');
    }
  }

  async synthesize(request: TTSRequest): Promise<TTSResult> {
    const text = extractScriptText(request.script);
    const speechConfig = sdk.SpeechConfig.fromSubscription(this.speechKey, this.speechRegion);
    speechConfig.speechSynthesisVoiceName = this.speechVoice;
    speechConfig.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Audio24Khz48KBitRateMonoMp3;

    const synthesizer = new sdk.SpeechSynthesizer(speechConfig);

    const result = await new Promise<sdk.SpeechSynthesisResult>((resolve, reject) => {
      synthesizer.speakTextAsync(
        text,
        (synthesisResult) => {
          if (synthesisResult.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
            resolve(synthesisResult);
            return;
          }
          reject(new Error(`Azure speech synthesis failed: ${synthesisResult.errorDetails || synthesisResult.reason}`));
        },
        (err) => reject(new Error(`Azure speech synthesis error: ${String(err)}`))
      );
    }).finally(() => synthesizer.close());

    const audioBuffer = Buffer.from(result.audioData);
    const blobServiceClient = BlobServiceClient.fromConnectionString(this.blobConnectionString);
    const containerClient = blobServiceClient.getContainerClient(this.blobContainerAudio);
    await containerClient.createIfNotExists();

    const outputBase = request.output_basename
      ?? `${request.student_id ?? 'student'}-${request.topic ?? 'topic'}-${Date.now()}`;
    const blobPath = `${slugify(outputBase)}.mp3`;
    const blobClient = containerClient.getBlockBlobClient(blobPath);

    await blobClient.uploadData(audioBuffer, {
      blobHTTPHeaders: { blobContentType: 'audio/mpeg' },
    });

    const durationSeconds = result.audioDuration
      ? Math.round(result.audioDuration / 10_000_000)
      : estimateDurationSeconds(text);

    return {
      audio_url: blobClient.url,
      duration_seconds: durationSeconds,
      blob_path: blobPath,
    };
  }
}

export class MockTTSService implements ITTSService {
  async synthesize(request: TTSRequest): Promise<TTSResult> {
    const text = extractScriptText(request.script);
    const duration = estimateDurationSeconds(text);
    const outputBase = request.output_basename
      ?? `${request.student_id ?? 'student'}-${request.topic ?? 'topic'}-${Date.now()}`;
    const blobPath = `mock/audio/${slugify(outputBase)}.mp3`;

    return {
      audio_url: `https://mock.blob.local/${blobPath}`,
      duration_seconds: duration,
      blob_path: blobPath,
    };
  }
}

export function hasAzureTTSConfig(env = process.env): boolean {
  return Boolean(
    env.AZURE_SPEECH_KEY
      && env.AZURE_SPEECH_REGION
      && env.AZURE_BLOB_CONNECTION_STRING
      && env.AZURE_BLOB_CONTAINER_AUDIO
  );
}
