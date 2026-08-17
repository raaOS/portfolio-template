import { ContentService } from '@/lib/services/contentService';
import fallbackContactData from '@/data/contact.json';
import type { ContactData, UpdateContactData } from '@/types/contact';

const fallbackContact = fallbackContactData as ContactData;
const contactService = new ContentService<ContactData>('contact.json', fallbackContact);

function mergeContactData(data?: ContactData | null): ContactData {
  if (!data) return fallbackContact;

  const content = data.content
    ? {
        ...fallbackContact.content,
        ...data.content,
      }
    : fallbackContact.content;

  const info = {
    ...fallbackContact.info,
    ...data.info,
    socialMedia: {
      ...fallbackContact.info.socialMedia,
      ...data.info?.socialMedia,
    },
  };

  const formSettings = {
    ...fallbackContact.formSettings,
    ...data.formSettings,
    fields: {
      ...fallbackContact.formSettings.fields,
      ...data.formSettings?.fields,
    },
  };

  return {
    ...fallbackContact,
    ...data,
    content,
    info,
    formSettings,
  };
}


export async function getContactData(
  noCache: boolean | string = false,
  siteId = 'default-site'
): Promise<ContactData> {
  const actualNoCache = typeof noCache === 'boolean' ? noCache : false;
  const actualSiteId = typeof noCache === 'string' ? noCache : siteId;
  try {
    const data = await contactService.getData(actualNoCache, false, actualSiteId);
    return mergeContactData(data);
  } catch (error) {
    console.error('Error loading contact data from data backend:', error);
    return fallbackContact;
  }
}

export async function updateContactData(
  updates: UpdateContactData,
  siteId = 'default-site'
): Promise<ContactData> {
  const data = await getContactData(true, siteId);

  const updatedData: ContactData = {
    content: updates.content
      ? {
          ...data.content,
          ...updates.content,
        }
      : data.content,
    info: updates.info
      ? {
          ...data.info,
          ...updates.info,
          socialMedia: updates.info.socialMedia
            ? { ...(data.info?.socialMedia || {}), ...updates.info.socialMedia }
            : data.info?.socialMedia,
        }
      : data.info,
    formSettings: updates.formSettings
      ? {
          ...data.formSettings,
          ...updates.formSettings,
          fields: {
            ...data.formSettings?.fields,
            ...updates.formSettings.fields,
          },
        }
      : data.formSettings,
    lastUpdated: new Date().toISOString(),
  };

  const success = await contactService.saveData(updatedData, 'Update contact content', siteId);
  if (!success) {
    throw new Error('Failed to save contact data');
  }

  return updatedData;
}
