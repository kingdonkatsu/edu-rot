import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import { BlobServiceClient, type ContainerClient } from '@azure/storage-blob';
import type { VideoAssemblyRequest, VideoAssemblyResult } from '../types.js';

if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath as string);
}

export interface IVideoAssemblyService {
  assemble(request: VideoAssemblyRequest): Promise<VideoAssemblyResult>;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'video';
}

async function downloadUrlToFile(url: string, outputPath: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download media URL (${response.status}): ${url}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  await fs.writeFile(outputPath, Buffer.from(arrayBuffer));
}

function runFfmpeg(backgroundPath: string, audioPath: string, outputPath: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input(backgroundPath)
      .input(audioPath)
      .outputOptions([
        '-c:v copy',
        '-c:a aac',
        '-map 0:v:0',
        '-map 1:a:0',
        '-shortest',
      ])
      .save(outputPath)
      .on('end', () => resolve())
      .on('error', (error) => reject(error));
  });
}

function probeDurationSeconds(filePath: string): Promise<number> {
  return new Promise<number>((resolve) => {
    ffmpeg.ffprobe(filePath, (error, data) => {
      if (error || !data?.format?.duration) {
        resolve(0);
        return;
      }
      resolve(Math.max(0, Math.round(data.format.duration)));
    });
  });
}

export class FFmpegVideoAssemblyService implements IVideoAssemblyService {
  private readonly connectionString: string;
  private readonly videoContainer: string;
  private readonly outputContainer: string;

  constructor(opts?: {
    connectionString?: string;
    videoContainer?: string;
    outputContainer?: string;
  }) {
    this.connectionString = opts?.connectionString ?? process.env.AZURE_BLOB_CONNECTION_STRING ?? '';
    this.videoContainer = opts?.videoContainer ?? process.env.AZURE_BLOB_CONTAINER_VIDEO ?? '';
    this.outputContainer = opts?.outputContainer ?? process.env.AZURE_BLOB_CONTAINER_OUTPUT ?? '';

    if (!this.connectionString || !this.videoContainer || !this.outputContainer) {
      throw new Error('FFmpegVideoAssemblyService missing required Blob configuration');
    }
  }

  async assemble(request: VideoAssemblyRequest): Promise<VideoAssemblyResult> {
    const blobServiceClient = BlobServiceClient.fromConnectionString(this.connectionString);
    const videoContainerClient = blobServiceClient.getContainerClient(this.videoContainer);
    const outputContainerClient = blobServiceClient.getContainerClient(this.outputContainer);
    await outputContainerClient.createIfNotExists();

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'edu-rot-video-'));
    const backgroundLocalPath = path.join(tempDir, 'background.mp4');
    const audioLocalPath = path.join(tempDir, 'voiceover.mp3');
    const outputLocalPath = path.join(tempDir, 'output.mp4');

    try {
      const backgroundBlobPath = await this.resolveBackgroundPath(videoContainerClient, request.background_key);
      const backgroundBlobClient = videoContainerClient.getBlobClient(backgroundBlobPath);
      await backgroundBlobClient.downloadToFile(backgroundLocalPath);

      await downloadUrlToFile(request.audio_url, audioLocalPath);
      await runFfmpeg(backgroundLocalPath, audioLocalPath, outputLocalPath);

      const outputBase = request.output_basename ?? `${request.background_key}-${Date.now()}`;
      const blobPath = `${slugify(outputBase)}.mp4`;
      const outputBlob = outputContainerClient.getBlockBlobClient(blobPath);
      const outputBuffer = await fs.readFile(outputLocalPath);
      await outputBlob.uploadData(outputBuffer, {
        blobHTTPHeaders: { blobContentType: 'video/mp4' },
      });

      return {
        video_url: outputBlob.url,
        duration_seconds: await probeDurationSeconds(outputLocalPath),
        blob_path: blobPath,
      };
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  }

  private async resolveBackgroundPath(
    videoContainerClient: ContainerClient,
    backgroundKey: string
  ): Promise<string> {
    const candidate = `backgrounds/${slugify(backgroundKey)}.mp4`;
    const fallback = 'backgrounds/general.mp4';

    if (await videoContainerClient.getBlobClient(candidate).exists()) {
      return candidate;
    }

    return fallback;
  }
}

export class MockVideoAssemblyService implements IVideoAssemblyService {
  async assemble(request: VideoAssemblyRequest): Promise<VideoAssemblyResult> {
    const base = request.output_basename ?? `${request.background_key}-${Date.now()}`;
    const blobPath = `mock/video/${slugify(base)}.mp4`;

    return {
      video_url: `https://mock.blob.local/${blobPath}`,
      duration_seconds: 60,
      blob_path: blobPath,
    };
  }
}

export function hasAzureVideoAssemblyConfig(env = process.env): boolean {
  return Boolean(
    env.AZURE_BLOB_CONNECTION_STRING
      && env.AZURE_BLOB_CONTAINER_VIDEO
      && env.AZURE_BLOB_CONTAINER_OUTPUT
  );
}
