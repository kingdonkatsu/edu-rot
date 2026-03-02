import ffmpeg from 'fluent-ffmpeg';

export class VideoGenService {
    async overlayTTS(
        backgroundVideoPath: string,
        ttsAudioPath: string,
        outputPath: string
    ): Promise<string> {
        return new Promise((resolve, reject) => {
            ffmpeg(backgroundVideoPath)
                .input(ttsAudioPath)
                .complexFilter([
                    // Adjust audio levels: duck background if needed, but for brain rot we usually keep it loud
                    '[0:a]volume=0.3[bg_audio]',
                    '[1:a]volume=1.5[tts_audio]',
                    '[bg_audio][tts_audio]amix=inputs=2:duration=first[a]'
                ])
                .map('0:v') // Keep video from background
                .map('[a]')   // Map mixed audio
                .outputOptions('-shortest') // End when shortest input ends (usually the video clip or TTS)
                .on('end', () => resolve(outputPath))
                .on('error', (err) => reject(new Error(`FFmpeg error: ${err.message}`)))
                .save(outputPath);
        });
    }
}
