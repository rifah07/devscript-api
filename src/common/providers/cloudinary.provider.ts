import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

// Named token for DI - we inject this symbol to get the configured instance
export const CLOUDINARY = 'CLOUDINARY';

export const CloudinaryProvider: Provider = {
  provide: CLOUDINARY,
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => {
    const cloudName = configService.get<string>('cloudinary.cloudName');
    const apiKey = configService.get<string>('cloudinary.apiKey');
    const apiSecret = configService.get<string>('cloudinary.apiSecret');

    if (!cloudName || !apiKey || !apiSecret) {
      throw new Error('Cloudinary credentials are not fully defined');
    }

    return cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
    });
  },
};
