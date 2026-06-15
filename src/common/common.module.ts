import { Module } from '@nestjs/common';
import { CloudinaryProvider } from './providers/cloudinary.provider';
import { UploadService } from './services/upload.service';

@Module({
  providers: [CloudinaryProvider, UploadService],
  exports: [UploadService],
})
export class CommonModule {}
