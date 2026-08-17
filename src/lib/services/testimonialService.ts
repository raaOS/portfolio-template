/**
 * Testimonial Service — CRUD data testimoni visitor.
 *
 * Instansiasi ContentService dengan fallback JSON. Mendukung
 * approve/reject, hapus avatar dari R2 saat testimonial dihapus.
 *
 * @module testimonialService
 */
import { ContentService } from './contentService';
import { Testimonial, TestimonialData } from '@/types/testimonial';
import testimonialDataFallback from '@/data/testimonial.json';
import { deleteStorageAssets } from '@/lib/services/storageCleanup';
import { db } from '@/lib/database';

// Counter untuk menghindari collision pada timestamp yang sama
let idCounter = 0;

// Ensure consistent fallback structure
interface TestimonialJsonData {
  testimonials?: unknown[];
  lastUpdated?: string;
}

const defaultData: TestimonialData = {
  testimonials:
    ((testimonialDataFallback as TestimonialJsonData).testimonials as Testimonial[]) || [],
  lastUpdated:
    (testimonialDataFallback as TestimonialJsonData).lastUpdated || new Date().toISOString(),
};

const emptyTenantData = (): TestimonialData => ({
  testimonials: [],
  lastUpdated: new Date().toISOString(),
});

const service = new ContentService<TestimonialData>('testimonial.json', defaultData);

const normalizeTestimonialId = (id: Testimonial['id'] | number): string => String(id).trim();

const normalizeTestimonial = (testimonial: Testimonial): Testimonial => ({
  ...testimonial,
  id: normalizeTestimonialId(testimonial.id),
});

const normalizeTestimonialData = (data: TestimonialData): TestimonialData => ({
  ...data,
  testimonials: data.testimonials.map(normalizeTestimonial),
});

const generateTestimonialId = (): string => {
  idCounter = (idCounter + 1) % 10000;
  return `testimonial-${Date.now()}-${idCounter}-${Math.random().toString(36).slice(2, 8)}`;
};
export const testimonialService = {
  async getTestimonials(
    noCache: boolean | string = false,
    throwOnError = false,
    siteId = 'default-site'
  ): Promise<TestimonialData> {
    const actualNoCache = typeof noCache === 'boolean' ? noCache : false;
    const actualSiteId = typeof noCache === 'string' ? noCache : siteId;
    const data = await service.getData(actualNoCache, throwOnError, actualSiteId);
    return normalizeTestimonialData(data);
  },

  async getSiteTestimonials(siteId: string): Promise<TestimonialData> {
    const finalSiteId = siteId.trim() || 'default-site';
    if (finalSiteId === 'default-site') {
      return this.getTestimonials(true, true, finalSiteId);
    }

    const snapshot = await db.ref(`content_${finalSiteId}/testimonial`).once('value');
    const remoteData = snapshot.val() as TestimonialData | null;
    if (!remoteData || !Array.isArray(remoteData.testimonials)) {
      return emptyTenantData();
    }

    return normalizeTestimonialData({
      ...remoteData,
      lastUpdated: remoteData.lastUpdated || new Date().toISOString(),
    });
  },

  async createTestimonial(
    data: Omit<Testimonial, 'id'>,
    siteId = 'default-site'
  ): Promise<Testimonial> {
    const currentData = await this.getSiteTestimonials(siteId);
    const existingIds = new Set(currentData.testimonials.map((t) => t.id));
    let finalId = generateTestimonialId();
    while (existingIds.has(finalId)) {
      finalId = generateTestimonialId();
    }

    const newTestimonial: Testimonial = {
      ...data,
      id: finalId,
      isActive: data.isActive !== undefined ? data.isActive : true,
    };

    currentData.testimonials.push(newTestimonial);
    currentData.lastUpdated = new Date().toISOString();

    await service.saveData(currentData, `Add testimonial: ${newTestimonial.name}`, siteId);
    return newTestimonial;
  },

  async updateTestimonial(
    id: number | string,
    updates: Partial<Testimonial>,
    siteId = 'default-site'
  ): Promise<Testimonial | null> {
    const currentData = await this.getSiteTestimonials(siteId);
    const normalizedId = normalizeTestimonialId(id);
    const index = currentData.testimonials.findIndex((t) => t.id === normalizedId);

    if (index === -1) return null;

    const updatedTestimonial = {
      ...currentData.testimonials[index],
      ...updates,
    };

    currentData.testimonials[index] = updatedTestimonial;
    currentData.lastUpdated = new Date().toISOString();

    await service.saveData(currentData, `Update testimonial: ${updatedTestimonial.name}`, siteId);
    return updatedTestimonial;
  },

  async deleteTestimonial(id: number | string, siteId = 'default-site'): Promise<boolean> {
    const currentData = await this.getSiteTestimonials(siteId);
    const normalizedId = normalizeTestimonialId(id);
    const testimonial = currentData.testimonials.find((t) => t.id === normalizedId);

    if (!testimonial) return false;

    // Cleanup Storage Assets inside Testimonial Chat
    const assetUrls: string[] = [];
    testimonial.messages?.forEach((msg) => {
      if (msg.imageSrc) assetUrls.push(msg.imageSrc);
    });
    await deleteStorageAssets(assetUrls, 'TestimonialService');

    currentData.testimonials = currentData.testimonials.filter((t) => t.id !== normalizedId);
    currentData.lastUpdated = new Date().toISOString();
    await service.saveData(currentData, `Delete testimonial ID: ${id}`, siteId);
    return true;
  },
};
