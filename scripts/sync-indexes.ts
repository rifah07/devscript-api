// Run once after deploying schema index changes:  npm run db:sync-indexes
// Boots the app without HTTP, then makes every collection's indexes match
// the schemas (creates new ones, drops ones no schema declares any more).
import { NestFactory } from '@nestjs/core';
import { getConnectionToken } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';
import { AppModule } from '../src/app.module';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const connection = app.get<Connection>(getConnectionToken());
  for (const model of Object.values(connection.models)) {
    const dropped = await model.syncIndexes();
    console.log(`${model.modelName}: synced${dropped.length ? `, dropped ${dropped.join(', ')}` : ''}`);
  }
  await app.close();
}

void main();
