import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { FileUploadService } from './file-upload.service';


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

@Controller()
export class FileUploadController {
    constructor(private readonly fileUploadService: FileUploadService) { }

    @MessagePattern('upload_file')
    async uploadFile(@Payload() payload: FileUploadRequest): Promise<FileUploadResponse> {
        try {
            const { files, fileNames, userId, metadata } = payload.data;

            if (!files || !files.length) {
                return {
                    success: false,
                    error: 'No files provided',
                };
            }

            const result = await this.fileUploadService.uploadSingleFile(
                files[0],
                fileNames?.[0] || 'uploaded_file',
                userId,
                metadata,
            );

            return {
                success: true,
                message: 'File uploaded successfully',
                data: {
                    fileId: result.id,
                    fileInfo: result,
                },
            };
        } catch (error) {
            return {
                success: false,
                error: error.message || 'File upload failed',
            };
        }
    }

    @MessagePattern('upload_files')
    async uploadFiles(@Payload() payload: FileUploadRequest): Promise<FileUploadResponse> {
        try {
            const { files, fileNames, userId, metadata } = payload.data;

            if (!files || !files.length) {
                return {
                    success: false,
                    error: 'No files provided',
                };
            }

            const results = await this.fileUploadService.uploadMultipleFiles(
                files,
                fileNames || files.map((_, index) => `file_${index}`),
                userId,
                metadata,
            );

            return {
                success: true,
                message: 'Files uploaded successfully',
                data: {
                    fileIds: results.map(result => result.id),
                },
            };
        } catch (error) {
            return {
                success: false,
                error: error.message || 'Files upload failed',
            };
        }
    }

    @MessagePattern('delete_file')
    async deleteFile(@Payload() payload: FileUploadRequest): Promise<FileUploadResponse> {
        try {
            const { fileId } = payload.data;

            if (!fileId) {
                return {
                    success: false,
                    error: 'File ID is required',
                };
            }

            await this.fileUploadService.deleteFile(fileId);

            return {
                success: true,
                message: 'File deleted successfully',
            };
        } catch (error) {
            return {
                success: false,
                error: error.message || 'File deletion failed',
            };
        }
    }

    @MessagePattern('get_file_info')
    async getFileInfo(@Payload() payload: FileUploadRequest): Promise<FileUploadResponse> {
        try {
            const { fileId } = payload.data;

            if (!fileId) {
                return {
                    success: false,
                    error: 'File ID is required',
                };
            }

            const fileInfo = await this.fileUploadService.getFileInfo(fileId);

            if (!fileInfo) {
                return {
                    success: false,
                    error: 'File not found',
                };
            }

            return {
                success: true,
                data: {
                    fileInfo,
                },
            };
        } catch (error) {
            return {
                success: false,
                error: error.message || 'Failed to get file info',
            };
        }
    }
}
