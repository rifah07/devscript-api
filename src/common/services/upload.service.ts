import { Injectable, BadRequestException } from '@nestjs/common';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { Readable } from 'stream';

/// <reference types="multer" />

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

  async uploadPostCover(file: Express.Multer.File): Promise<UploadResult> {
    this.validateImageFile(file);

    const result = await this.uploadStream(file.buffer, {
      folder: 'devscript/covers',
      transformation: [
        { width: 1200, height: 630, crop: 'fill' },
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

  async deleteFile(publicId: string): Promise<void> {
    await cloudinary.uploader.destroy(publicId);
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private validateImageFile(file: Express.Multer.File): void {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        'Invalid file type. Only JPEG, PNG, and WebP are allowed',
      );
    }

    const maxSizeBytes = 5 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      throw new BadRequestException('File too large. Maximum size is 5MB');
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
}
