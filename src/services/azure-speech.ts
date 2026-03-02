import * as sdk from 'microsoft-cognitiveservices-speech-sdk';

export class AzureSpeechService {
    private speechConfig: sdk.SpeechConfig;

    constructor() {
        const speechKey = process.env.AZURE_SPEECH_KEY;
        const speechRegion = process.env.AZURE_SPEECH_REGION;

        if (!speechKey || !speechRegion) {
            throw new Error('AZURE_SPEECH_KEY or AZURE_SPEECH_REGION is not set');
        }

        this.speechConfig = sdk.SpeechConfig.fromSubscription(speechKey, speechRegion);
        // Set default voice (Hyper-energetic for brain rot)
        this.speechConfig.speechSynthesisVoiceName = 'en-US-GuyNeural';
    }

    async generateTTS(text: string, localOutputPath: string): Promise<string> {
        const audioConfig = sdk.AudioConfig.fromAudioFileOutput(localOutputPath);
        const synthesizer = new sdk.SpeechSynthesizer(this.speechConfig, audioConfig);

        return new Promise((resolve, reject) => {
            synthesizer.speakTextAsync(
                text,
                (result) => {
                    if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
                        resolve(localOutputPath);
                    } else {
                        reject(new Error(`Speech synthesis failed: ${result.errorDetails}`));
                    }
                    synthesizer.close();
                },
                (error) => {
                    reject(error);
                    synthesizer.close();
                }
            );
        });
    }
}
