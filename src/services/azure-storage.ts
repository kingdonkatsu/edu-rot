import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';
import path from 'path';

export class AzureStorageService {
    private blobServiceClient: BlobServiceClient;
    private videoContainer: ContainerClient;
    private outputContainer: ContainerClient;
    private dataContainer: ContainerClient;

    constructor() {
        const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
        if (!connectionString) {
            throw new Error('AZURE_STORAGE_CONNECTION_STRING is not set');
        }
        this.blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
        this.videoContainer = this.blobServiceClient.getContainerClient('background-videos');
        this.outputContainer = this.blobServiceClient.getContainerClient('processed-videos');
        this.dataContainer = this.blobServiceClient.getContainerClient('export-data');
    }

    async getRandomBackgroundVideo(localDownloadPath: string): Promise<string> {
        const blobs = this.videoContainer.listBlobsFlat();
        const videoList: string[] = [];
        for await (const blob of blobs) {
            if (blob.name.endsWith('.mp4')) {
                videoList.push(blob.name);
            }
        }

        if (videoList.length === 0) {
            throw new Error('No background videos found in Azure Blob Storage');
        }

        const randomVideo = videoList[Math.floor(Math.random() * videoList.length)];
        const blockBlobClient = this.videoContainer.getBlockBlobClient(randomVideo);

        const downloadFilePath = path.join(localDownloadPath, randomVideo);
        await blockBlobClient.downloadToFile(downloadFilePath);

        return downloadFilePath;
    }

    async uploadProcessedVideo(localPath: string): Promise<string> {
        const fileName = path.basename(localPath);
        const blockBlobClient = this.outputContainer.getBlockBlobClient(fileName);
        await blockBlobClient.uploadFile(localPath);
        return blockBlobClient.url;
    }

    async exportMetrics(studentId: string, data: string): Promise<void> {
        const fileName = `metrics_${studentId}_${Date.now()}.csv`;
        const blockBlobClient = this.dataContainer.getBlockBlobClient(fileName);
        await blockBlobClient.upload(data, data.length);
    }
}
