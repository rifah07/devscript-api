import { Injectable, BadRequestException } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { Readable } from 'stream';
import { detectImageType } from '../utils/image-signature.util';

/// <reference types="multer" />

// Multer stops reading a file past this size (413), so a huge upload is
// never buffered into memory just to be rejected afterwards.
export const UPLOAD_LIMITS = {
  fileSize: 4 * 1024 * 1024,
  files: 10,
  fields: 10,
};

export interface UploadResult {
  url: string;
  publicId: string;
  width: number;
  height: number;
  format: string;
}

@Injectable()
export class UploadService {
  async uploadAvatar(file: Express.Multer.File): Promise<UploadResult> {
    this.validateImageFile(file);

    const result = await this.uploadStream(file.buffer, {
      folder: 'devscript/avatars',
      transformation: [
        { width: 400, height: 400, crop: 'fill', gravity: 'face' },
        { quality: 'auto', fetch_format: 'auto' },
      ],
    });

    return {
      url: result.secure_url,
      publicId: result.public_id,
      width: result.width,
      height: result.height,
      format: result.format,
    };
  }

  async uploadGalleryImage(file: Express.Multer.File): Promise<UploadResult> {
    this.validateImageFile(file);

    const result = await this.uploadStream(file.buffer, {
      folder: 'devscript/covers',
      // Keep the original shape (a portrait stays portrait); crops happen
      // per use at delivery time via URL variants. `limit` only shrinks.
      transformation: [
        { width: 2400, height: 2400, crop: 'limit' },
        { quality: 'auto', fetch_format: 'auto' },
      ],
      // Eager: pre-generate these specific sizes immediately at upload time
      // rather than waiting for the first viewer to request them.
      // Cloudinary processes these in the background — upload response
      // returns immediately, transformations complete within seconds.
      eager: [
        { width: 1000, height: 1500, crop: 'fill', gravity: 'auto' }, // pinterestPin
        { width: 1080, height: 1080, crop: 'fill', gravity: 'auto' }, // square
      ],
      eager_async: true, // don't block the upload response waiting for these
    });

    return {
      url: result.secure_url,
      publicId: result.public_id,
      width: result.width,
      height: result.height,
      format: result.format,
    };
  }

  async uploadNarrationAudio(
    audioBuffer: Buffer,
    postId: string,
  ): Promise<{ url: string; publicId: string }> {
    const result = await this.uploadAudioStream(audioBuffer, {
      folder: 'devscript/narrations',
      resource_type: 'video', // Cloudinary's quirk — audio uses the video pipeline
      public_id: `narration-${postId}-${Date.now()}`,
    });

    return {
      url: result.secure_url,
      publicId: result.public_id,
    };
  }

  async deleteFile(publicId: string): Promise<void> {
    await cloudinary.uploader.destroy(publicId);
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private validateImageFile(file: Express.Multer.File): void {
    // Check the bytes, not the client's claimed MIME type.
    if (!file?.buffer || !detectImageType(file.buffer)) {
      throw new BadRequestException(
        'Invalid file type. Only JPEG, PNG, and WebP are allowed',
      );
    }

    // Vercel functions accept at most 4.5 MB per request body.
    const maxSizeBytes = 4 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      throw new BadRequestException('File too large. Maximum size is 4MB');
    }
  }

  private uploadStream(
    buffer: Buffer,
    options: Record<string, unknown>,
  ): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        options,
        (error, result) => {
          if (error) return reject(new Error(error.message));
          if (!result) {
            return reject(new Error('Upload failed — no result returned'));
          }
          resolve(result);
        },
      );

      const readable = new Readable();
      readable.push(buffer);
      readable.push(null);
      readable.pipe(stream);
    });
  }

  private uploadAudioStream(
    buffer: Buffer,
    options: Record<string, unknown>,
  ): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        options,
        (error, result) => {
          if (error) return reject(new Error(error.message));
          if (!result)
            return reject(
              new Error('Audio upload failed — no result returned'),
            );
          resolve(result);
        },
      );

      const readable = new Readable();
      readable.push(buffer);
      readable.push(null);
      readable.pipe(stream);
    });
  }
}
