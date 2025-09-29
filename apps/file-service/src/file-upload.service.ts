import { Injectable } from '@nestjs/common';
import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';


export interface FileInfo {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  url: string;
  createdAt?: Date;
  userId?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class FileUploadService {
  private readonly s3: S3Client;
  private readonly bucketName: string;
  private readonly maxFileSize = 5 * 1024 * 1024; // 5MB
  private readonly allowedMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'application/pdf',
  ];

  constructor() {
    this.s3 = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });
    this.bucketName = process.env.AWS_S3_BUCKET || 'your-bucket-name';
  }

  private validateFile(buffer: Buffer, mimeType: string): boolean {
    // Check file size
    if (buffer.length > this.maxFileSize) {
      throw new Error('File size exceeds maximum allowed size (5MB)');
    }

    // Check MIME type
    if (!this.allowedMimeTypes.includes(mimeType)) {
      throw new Error(`Invalid file type: ${mimeType}`);
    }

    return true;
  }

  private getMimeTypeFromBuffer(buffer: Buffer): string {
    // Simple MIME type detection based on file signatures
    const signatures = {
      'image/jpeg': [0xff, 0xd8, 0xff],
      'image/png': [0x89, 0x50, 0x4e, 0x47],
      'application/pdf': [0x25, 0x50, 0x44, 0x46],
    };

    for (const [mimeType, signature] of Object.entries(signatures)) {
      if (signature.every((byte, index) => buffer[index] === byte)) {
        return mimeType;
      }
    }

    return 'application/octet-stream';
  }

  async getFileUrl(fileKey: string): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: fileKey,
      });

      const signedUrl = await getSignedUrl(this.s3, command, {
        expiresIn: 86400,
      });

      return signedUrl;
    } catch (error) {
      throw new Error('Failed to generate signed URL');
    }
  }

  async deleteFile(fileKey: string): Promise<void> {
    try {
      await this.s3.send(
        new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: fileKey,
        }),
      );
    } catch (error) {
      throw new Error('Failed to delete file');
    }
  }

  async uploadFileToS3(
    file: any,
    options: {
      folder?: string;
    } = {},
  ): Promise<{
    key: string;
    size: number;
    mimeType: string;
    url: string;
  }> {
    const { folder = 'uploads' } = options;

    const fileExtension = file.originalname.split('.').pop();
    const key = `${folder}/${Date.now()}-${Math.random()
      .toString(36)
      .substring(2)}.${fileExtension}`;

    const signedUrl = await this.getFileUrl(key);

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );
    return {
      key,
      size: file.size,
      mimeType: file.mimetype,
      url: signedUrl,
    };
  }

  async uploadSingleFile(
    buffer: Buffer,
    originalName: string,
    userId?: string,
    metadata?: Record<string, any>,
  ): Promise<FileInfo> {
    const mimeType = this.getMimeTypeFromBuffer(buffer);
    this.validateFile(buffer, mimeType);

    const file = {
      buffer,
      originalname: originalName,
      mimetype: mimeType,
      size: buffer.length,
    };

    const s3Result = await this.uploadFileToS3(file, { folder: 'uploads' });

    const fileInfo: FileInfo = {
      id: s3Result.key,
      name: originalName,
      size: s3Result.size,
      mimeType: s3Result.mimeType,
      url: s3Result.url,
      createdAt: new Date(),
      userId,
      metadata,
    };

    return fileInfo;
  }

  async uploadMultipleFiles(
    buffers: Buffer[],
    originalNames: string[],
    userId?: string,
    metadata?: Record<string, any>,
  ): Promise<FileInfo[]> {
    const results: FileInfo[] = [];

    for (let i = 0; i < buffers.length; i++) {
      const result = await this.uploadSingleFile(
        buffers[i],
        originalNames[i] || `file_${i}`,
        userId,
        metadata,
      );
      results.push(result);
    }

    return results;
  }

  async getFileInfo(fileId: string): Promise<FileInfo | null> {
    try {
      // In a real application, you would look this up in the database
      // For now, we'll generate a signed URL for the file
      const url = await this.getFileUrl(fileId);

      return {
        id: fileId,
        name: fileId.split('/').pop() || 'unknown',
        size: 0, // Would need to get from S3 metadata
        mimeType: 'application/octet-stream', // Would need to get from S3 metadata
        url,
        createdAt: new Date(),
      };
    } catch (error) {
      console.error('Error getting file info:', error);
      return null;
    }
  }
}
