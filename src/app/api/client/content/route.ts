import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { unauthorized, validationError } from '@/lib/api-response';
import { validateClientRequest } from '@/lib/clientAuth';
import { getContactData, updateContactData } from '@/lib/contact';
import { aboutService } from '@/lib/services/aboutService';
import { experienceService } from '@/lib/services/experienceService';
import { hardSkillService } from '@/lib/services/hardSkillService';
import type { UpdateAboutData } from '@/types/about';
import type { UpdateContactData } from '@/types/contact';
import type { WorkExperience } from '@/types/experience';
import type { HardSkill, HardSkillLevel } from '@/types/hardSkill';

export const dynamic = 'force-dynamic';

const optionalText = (max: number) => z.string().trim().max(max).optional();
const requiredText = (max: number) => z.string().trim().min(1).max(max);

const profileSchema = z
  .object({
    heroTitle: requiredText(200).optional(),
    availabilityStatus: z.enum(['available', 'booked', 'limited']).optional(),
    availabilityText: optionalText(200),
    mottoBadge: optionalText(200),
    mottoQuote: optionalText(1000),
    bio: optionalText(10000),
    email: optionalText(200),
    whatsapp: optionalText(50),
    linkedin: optionalText(200),
    phone: optionalText(50),
    address: optionalText(300),
    instagram: optionalText(200),
    behance: optionalText(200),
    contactHeadline: optionalText(200),
    contactSubtext: optionalText(1000),
  })
  .strict();

const statisticsSchema = z
  .object({
    years: requiredText(50).optional(),
    projects: requiredText(50).optional(),
    designTools: requiredText(50).optional(),
    clientSatisfaction: requiredText(50).optional(),
  })
  .strict();

const workExperienceItemSchema = z
  .object({
    id: optionalText(120),
    year: requiredText(50),
    duration: requiredText(50),
    company: requiredText(120),
    position: requiredText(120),
    descriptionText: z.string().trim().max(5000),
    imageUrl: optionalText(1000),
    isActive: z.boolean().optional(),
  })
  .strict();

const hardSkillItemSchema = z
  .object({
    id: optionalText(120),
    name: requiredText(120),
    level: z.enum(['Beginner', 'Intermediate', 'Advanced', 'Expert']),
    description: optionalText(1000),
    iconUrl: optionalText(1000),
    isActive: z.boolean().optional(),
  })
  .strict();

const clientContentSchema = z
  .object({
    profile: profileSchema.optional(),
    statistics: statisticsSchema.optional(),
    workExperience: z.array(workExperienceItemSchema).min(1).max(30).optional(),
    hardSkills: z.array(hardSkillItemSchema).min(1).max(40).optional(),
  })
  .strict()
  .refine(
    (payload) =>
      payload.profile !== undefined ||
      payload.statistics !== undefined ||
      payload.workExperience !== undefined ||
      payload.hardSkills !== undefined,
    'At least one content section must be updated'
  );

function splitDescription(value: string) {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 20);
}

function serializeWorkExperience(work: WorkExperience) {
  return {
    id: work.id,
    year: work.year,
    duration: work.duration,
    company: work.company,
    position: work.position,
    descriptionText: (work.description || []).join('\n'),
    imageUrl: work.imageUrl || '',
    isActive: work.isActive !== false,
  };
}

function serializeHardSkill(skill: HardSkill) {
  return {
    id: skill.id,
    name: skill.name,
    level: skill.level,
    description: skill.description || '',
    iconUrl: skill.iconUrl || '',
    isActive: skill.isActive !== false,
  };
}

function revalidateClientTenant(siteSlug: string) {
  revalidatePath(`/${siteSlug}`, 'layout');
  revalidatePath(`/${siteSlug}`);
  revalidatePath(`/${siteSlug}/about`);
  revalidatePath(`/${siteSlug}/contact`);
  revalidatePath(`/${siteSlug}/cv`);
}

function buildHardSkillId(name: string, index: number) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return `hard-client-${slug || 'skill'}-${index + 1}`;
}

export async function GET(request: NextRequest) {
  try {
    const session = await validateClientRequest(request, { checkCsrf: false });
    if (!session) return unauthorized('Client session is required');

    const [about, contact, experience, hardSkills] = await Promise.all([
      aboutService.getAboutData(false, true, session.siteId),
      getContactData(false, session.siteId),
      experienceService.getExperienceData(false, true, session.siteId),
      hardSkillService.getHardSkills(false, true, session.siteId),
    ]);

    return NextResponse.json(
      {
        success: true,
        data: {
          profile: {
            heroTitle: about.hero.title,
            availabilityStatus: about.hero.availability?.status || 'available',
            availabilityText: about.hero.availability?.text || '',
            mottoBadge: about.professional.motto?.badge || '',
            mottoQuote: about.professional.motto?.quote || '',
            bio: about.professional.bio?.content || '',
            email: about.professional.contacts?.email || contact.info.email || '',
            whatsapp:
              about.professional.contacts?.whatsapp || contact.info.socialMedia?.whatsapp || '',
            linkedin:
              about.professional.contacts?.linkedin || contact.info.socialMedia?.linkedin || '',
            phone: contact.info.phone || '',
            address: contact.info.address || '',
            instagram: contact.info.socialMedia?.instagram || '',
            behance: contact.info.socialMedia?.behance || '',
            contactHeadline: contact.content?.headline || '',
            contactSubtext: contact.content?.subtext || '',
          },
          statistics: experience.statistics,
          workExperience: experience.workExperience.map(serializeWorkExperience),
          hardSkills: hardSkills.skills.map(serializeHardSkill),
        },
      },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (error) {
    console.error('[Client Content GET] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to read client content' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await validateClientRequest(request);
    if (!session) return unauthorized('Client session is required');

    const rawBody = await request.json().catch(() => ({}));
    const validationResult = clientContentSchema.safeParse(rawBody);
    if (!validationResult.success) return validationError(validationResult.error);

    const payload = validationResult.data;
    const writes: Promise<unknown>[] = [];

    if (payload.profile) {
      const [about, contact] = await Promise.all([
        aboutService.getAboutData(true, true, session.siteId),
        getContactData(true, session.siteId),
      ]);
      const profile = payload.profile;

      const aboutUpdate: UpdateAboutData = {
        hero: {
          ...about.hero,
          title: profile.heroTitle ?? about.hero.title,
          availability: {
            status: profile.availabilityStatus ?? about.hero.availability?.status ?? 'available',
            text: profile.availabilityText ?? about.hero.availability?.text ?? '',
            text_id: about.hero.availability?.text_id,
          },
        },
        professional: {
          ...about.professional,
          contacts: {
            email: profile.email ?? about.professional.contacts?.email ?? '',
            whatsapp: profile.whatsapp ?? about.professional.contacts?.whatsapp ?? '',
            linkedin: profile.linkedin ?? about.professional.contacts?.linkedin ?? '',
          },
          motto: {
            ...about.professional.motto,
            badge: profile.mottoBadge ?? about.professional.motto?.badge ?? '',
            quote: profile.mottoQuote ?? about.professional.motto?.quote ?? '',
          },
          bio: {
            ...about.professional.bio,
            content: profile.bio ?? about.professional.bio?.content ?? '',
          },
        },
      };

      const contactUpdate: UpdateContactData = {
        content: {
          headline: profile.contactHeadline ?? contact.content?.headline ?? '',
          subtext: profile.contactSubtext ?? contact.content?.subtext ?? '',
        },
        info: {
          email: profile.email ?? contact.info.email ?? '',
          phone: profile.phone ?? contact.info.phone ?? '',
          address: profile.address ?? contact.info.address ?? '',
          socialMedia: {
            ...(contact.info.socialMedia || {}),
            whatsapp: profile.whatsapp ?? contact.info.socialMedia?.whatsapp ?? '',
            linkedin: profile.linkedin ?? contact.info.socialMedia?.linkedin ?? '',
            instagram: profile.instagram ?? contact.info.socialMedia?.instagram ?? '',
            behance: profile.behance ?? contact.info.socialMedia?.behance ?? '',
          },
        },
      };

      writes.push(aboutService.updateAboutData(aboutUpdate, session.siteId));
      writes.push(updateContactData(contactUpdate, session.siteId));
    }

    if (payload.statistics || (payload.workExperience && payload.workExperience.length > 0)) {
      const current = await experienceService.getExperienceData(true, true, session.siteId);
      const workExperience = payload.workExperience?.map((item) => ({
        id: item.id || '',
        year: item.year,
        duration: item.duration,
        company: item.company,
        position: item.position,
        description: splitDescription(item.descriptionText),
        imageUrl: item.imageUrl || '',
        isActive: item.isActive,
      }));

      writes.push(
        experienceService.updateExperienceData(
          {
            statistics: payload.statistics
              ? {
                  ...current.statistics,
                  ...payload.statistics,
                }
              : undefined,
            workExperience,
          },
          session.siteId
        )
      );
    }

    if (payload.hardSkills && payload.hardSkills.length > 0) {
      const current = await hardSkillService.getHardSkills(true, true, session.siteId);
      const currentById = new Map(current.skills.map((skill) => [skill.id, skill]));
      const now = new Date().toISOString();
      const hardSkills = payload.hardSkills.map((skill, index): HardSkill => {
        const currentSkill = skill.id ? currentById.get(skill.id) : undefined;
        return {
          id: skill.id || buildHardSkillId(skill.name, index),
          name: skill.name,
          iconUrl: skill.iconUrl || currentSkill?.iconUrl || '',
          level: skill.level as HardSkillLevel,
          order: index + 1,
          description: skill.description || '',
          isActive: skill.isActive,
          createdAt: currentSkill?.createdAt || now,
          updatedAt: now,
        };
      });
      writes.push(hardSkillService.saveHardSkills(hardSkills, 'Client update hard skills', session.siteId));
    }

    await Promise.all(writes);
    revalidateClientTenant(session.siteSlug);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Client Content PUT] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update client content' },
      { status: 500 }
    );
  }
}
