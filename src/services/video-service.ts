import { AzureStorageService } from './azure-storage.js';
import { AzureSpeechService } from './azure-speech.js';
import { VideoGenService } from './video-gen.js';
import path from 'path';
import fs from 'fs';
import os from 'os';

export async function generateBrainRotVideo(text: string, studentId: string): Promise<string> {
    const storage = new AzureStorageService();
    const speech = new AzureSpeechService();
    const videoGen = new VideoGenService();

    const tempDir = path.join(os.tmpdir(), `edu-rot-${Date.now()}`);
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }

    try {
        const bgVideoPath = await storage.getRandomBackgroundVideo(tempDir);
        const ttsAudioPath = path.join(tempDir, 'tts.wav');
        await speech.generateTTS(text, ttsAudioPath);

        const outputPath = path.join(tempDir, `final_${studentId}_${Date.now()}.mp4`);
        await videoGen.overlayTTS(bgVideoPath, ttsAudioPath, outputPath);

        const url = await storage.uploadProcessedVideo(outputPath);
        return url;
    } finally {
        // Cleanup temp files
        try {
            if (fs.existsSync(tempDir)) {
                fs.rmSync(tempDir, { recursive: true, force: true });
            }
        } catch (e) {
            console.error('Failed to cleanup temp dir:', e);
        }
    }
}
