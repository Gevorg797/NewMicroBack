import { applyDecorators, UseInterceptors } from '@nestjs/common';
import {
  FileInterceptor,
  FilesInterceptor,
} from '@webundsoehne/nest-fastify-file-upload';
import { diskStorage } from 'fastify-multer';
import { extname } from 'path';
import { promises as fs } from 'fs';
import { ApiConsumes } from '@nestjs/swagger';


/**
 * Enum for valid MIME types.
 */
enum MimeTypeEnum {
  PDF = 'application/pdf',
  //   MP4 = 'video/mp4',
  //   WEBM = 'video/webm',
  JPG = 'image/jpg',
  JPEG = 'image/jpeg',
  PNG = 'image/png',
  //   M4A = 'audio/m4a',
  //   AUDIO_MP4 = 'audio/mp4',
  //   AUDIO_WEBM = 'audio/webm',
  //   AUDIO_OGG = 'audio/ogg',
  //   DOC = 'application/msword',
  //   DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  //   XLS = 'application/vnd.ms-excel',
  //   XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  //   DOCM = 'application/vnd.ms-word.document.macroEnabled.12',
  //   RTF = 'application/rtf',
  //   TXT = 'text/plain',
  //   KEY = 'application/vnd.apple.keynote',
  //   ODP = 'application/vnd.oasis.opendocument.presentation',
  //   PPS = 'application/vnd.ms-powerpoint',
  //   PPT = 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  //   ODT = 'application/vnd.oasis.opendocument.text',
  //   TEX = 'application/x-tex',
  //   WPD = 'application/vnd.wordperfect',
  //   HEIC = 'image/heic',
  //   MOV = 'video/quicktime',
  //   MP3 = 'audio/mp3',
  //   MPEG = 'audio/mpeg',
  //   OCTET_STREAM = 'application/octet-stream',
}

/**
 * Enum for valid file extensions.
 */
enum ExtensionEnum {
  PDF = 'pdf',
  //   MP4 = 'mp4',
  //   WEBM = 'webm',
  JPG = 'jpg',
  JPEG = 'jpeg',
  PNG = 'png',
  //   M4A = 'm4a',
  //   OGG = 'ogg',
  //   DOC = 'doc',
  //   DOCX = 'docx',
  //   XLSX = 'xlsx',
  //   XLS = 'xls',
  //   TXT = 'txt',
  //   DOCM = 'docm',
  //   RTF = 'rtf',
  //   KEY = 'key',
  //   ODP = 'odp',
  //   PPS = 'pps',
  //   PPT = 'ppt',
  //   PPTX = 'pptx',
  //   ODT = 'odt',
  //   TEX = 'tex',
  //   WPD = 'wpd',
  //   HEIC = 'heic',
  //   MOV = 'mov',
  //   MP3 = 'mp3',
  //   MPEG = 'mpeg',
}



export function UploadFiles(fileName = 'files', maxCount = 10) {
  return applyDecorators(
    ApiConsumes('multipart/form-data'),
    // ApiBody({
    //   description: 'Multiple file upload',
    //   required: true,
    //   schema: {
    //     type: 'object',
    //     properties: {
    //       [fileName]: {
    //         type: 'array',
    //         items: {
    //           type: 'string',
    //           format: 'binary',
    //         },
    //       },
    //     },
    //   },
    // }),
    UseInterceptors(
      FilesInterceptor(fileName, maxCount, {
        storage: diskStorage({
          filename: (_, file, callback) => {
            const fileExt = extname(file.originalname).toLowerCase();
            const uniqueSuffix =
              Date.now() + '-' + Math.round(Math.random() * 1e9);
            callback(null, `${file.fieldname}-${uniqueSuffix}${fileExt}`);
          },
        }),
        fileFilter: (_, file, callback) => {
          const ext = extname(file.originalname).replace('.', '').toLowerCase();
          if (
            !Object.values(ExtensionEnum).includes(ext as ExtensionEnum) ||
            !Object.values(MimeTypeEnum).includes(file.mimetype as MimeTypeEnum)
          ) {
            console.log(`❌ WRONG_FILE: ${file.mimetype} ${file.originalname}`);
            return callback(new Error(`Invalid file format: ${ext}`), false);
          }

          callback(null, true);
        },

        limits: { fileSize: 5 * 1024 * 1024 },
      }),
      {
        intercept: async (context, next) => {
          const request = context.switchToHttp().getRequest();
          const files = request.files;

          if (!files?.length) {
            console.warn('⚠️ No files found in request');
          }

          await Promise.all(
            files.map(async (file) => {
              try {
                file.buffer = await fs.readFile(file.path);
              } catch (err) {
                console.error(`❌ Failed to read file ${file.path}:`, err);
              }
            }),
          );

          return next.handle();
        },
      },
    ),
  );
}

export function UploadFileWithBody(fileName = 'file') {
  return applyDecorators(
    ApiConsumes('multipart/form-data'), // Enables file upload in Swagger UI

    UseInterceptors(
      FileInterceptor(fileName, {
        storage: diskStorage({
          // Save to temp directory before reading buffer
          //   destination: './tmp',
          filename: (_, file, callback) => {
            const fileExt = extname(file.originalname).toLowerCase();
            const uniqueSuffix =
              Date.now() + '-' + Math.round(Math.random() * 1e9);
            callback(null, `${file.fieldname}-${uniqueSuffix}${fileExt}`);
          },
        }),
        fileFilter: async (_, file, callback) => {
          const ext = extname(file.originalname).replace('.', '').toLowerCase();

          if (
            !Object.values(ExtensionEnum).includes(ext as ExtensionEnum) ||
            !Object.values(MimeTypeEnum).includes(file.mimetype as MimeTypeEnum)
          ) {
            console.log(`WRONG_FILE: ${file.mimetype} ${file.originalname}`);
            return callback(new Error(`Invalid file format: ${ext}`), false);
          }

          callback(null, true);
        },
      }),
      // Read buffer before passing to controller
      {
        intercept: async (context, next) => {
          const request = context.switchToHttp().getRequest();
          if (request.file) {
            request.file.buffer = await fs.readFile(request.file.path);
          }
          return next.handle();
        },
      },
    ),
  );
}
