import { ContentService } from '@/lib/services/contentService';
import labelsFallback from '@/data/labels.json';
import { Label } from '@/types/labels';

const service = new ContentService<Label[]>('labels.json', labelsFallback as Label[]);

export async function allLabelsAsync(siteId = 'default-site'): Promise<Label[]> {
  try {
    return service.getData(false, false, siteId);
  } catch (error) {
    console.error('Error fetching labels:', error);
    return labelsFallback as Label[];
  }
}
