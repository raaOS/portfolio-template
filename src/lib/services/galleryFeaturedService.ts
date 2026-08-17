/**
 * Gallery Featured Service — CRUD daftar project yang di-pin sebagai featured.
 *
 * @module galleryFeaturedService
 */
import { ContentService } from './contentService';
import { GalleryFeaturedData } from '@/types/gallery';
import galleryFeaturedFallback from '@/data/gallery-featured.json';

const defaultData: GalleryFeaturedData = {
  featuredProjectIds: (galleryFeaturedFallback as GalleryFeaturedData).featuredProjectIds || [],
  lastUpdated:
    (galleryFeaturedFallback as GalleryFeaturedData).lastUpdated || new Date().toISOString(),
};

const service = new ContentService<GalleryFeaturedData>('gallery-featured.json', defaultData);

export const galleryFeaturedService = {
  async getFeaturedData(siteId = 'default-site'): Promise<GalleryFeaturedData> {
    return service.getData(false, false, siteId);
  },

  async updateFeaturedData(
    featuredProjectIds: string[],
    siteId = 'default-site'
  ): Promise<GalleryFeaturedData> {
    const newData: GalleryFeaturedData = {
      featuredProjectIds,
      lastUpdated: new Date().toISOString(),
    };

    const success = await service.saveData(newData, 'Update featured gallery data', siteId);
    if (!success) {
      throw new Error('Failed to save featured gallery data');
    }

    return newData;
  },
};
