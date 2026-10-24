import { ConfigService } from '@nestjs/config';
import { PostSpace } from '../../posts/schemas/post.schema';

// Each space is its own site: links and branding in emails must match it.
export function siteFor(
  config: ConfigService,
  space: PostSpace,
): { url: string; name: string } {
  const url =
    space === PostSpace.PERSONAL
      ? config.get<string>('seo.miskJournalUrl')
      : config.get<string>('seo.devscriptUrl');
  const names = config.get<Record<string, string>>('seo.siteName');
  return { url: url ?? '', name: names?.[space] ?? 'Blog' };
}
