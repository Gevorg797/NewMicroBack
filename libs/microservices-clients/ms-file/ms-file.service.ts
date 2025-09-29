import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { MS_FILE } from './tokens';

export interface FileUploadRequest {
    pattern: 'upload_file' | 'upload_files' | 'delete_file' | 'get_file_info';
    data: {
        files?: Buffer[];
        fileNames?: string[];
        fileId?: string;
        userId?: string;
        metadata?: Record<string, any>;
    };
}

export interface FileUploadResponse {
    success: boolean;
    message?: string;
    data?: {
        fileIds?: string[];
        fileId?: string;
        fileInfo?: {
            id: string;
            name: string;
            size: number;
            mimeType: string;
            url: string;
            createdAt?: Date;
        };
    };
    error?: string;
}

@Injectable()
export class MsFileService {
    constructor(@Inject(MS_FILE) private readonly client: ClientProxy) { }

    async uploadFile(data: {
        files: Buffer[];
        fileNames?: string[];
        userId?: string;
        metadata?: Record<string, any>;
    }): Promise<FileUploadResponse> {
        const payload: FileUploadRequest = {
            pattern: 'upload_file',
            data,
        };
        return firstValueFrom(this.client.send('upload_file', payload));
    }

    async uploadFiles(data: {
        files: Buffer[];
        fileNames?: string[];
        userId?: string;
        metadata?: Record<string, any>;
    }): Promise<FileUploadResponse> {
        const payload: FileUploadRequest = {
            pattern: 'upload_files',
            data,
        };
        return firstValueFrom(this.client.send('upload_files', payload));
    }

    async deleteFile(data: {
        fileId: string;
    }): Promise<FileUploadResponse> {
        const payload: FileUploadRequest = {
            pattern: 'delete_file',
            data,
        };
        return firstValueFrom(this.client.send('delete_file', payload));
    }

    async getFileInfo(data: {
        fileId: string;
    }): Promise<FileUploadResponse> {
        const payload: FileUploadRequest = {
            pattern: 'get_file_info',
            data,
        };
        return firstValueFrom(this.client.send('get_file_info', payload));
    }
}
