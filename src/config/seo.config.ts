import { registerAs } from '@nestjs/config';

export default registerAs('seo', () => ({
  devscriptUrl: process.env.DEVSCRIPT_URL ?? 'https://devscript.com',
  miskJournalUrl: process.env.MISK_JOURNAL_URL ?? 'https://themiskjournal.com',
  siteName: {
    devscript: 'DevScript',
    personal: 'The Misk Journal',
  },
  siteDescription: {
    devscript:
      'A developer blogging platform for backend engineering, tutorials, and career growth.',
    personal: 'Poetry and reflections.',
  },
}));
