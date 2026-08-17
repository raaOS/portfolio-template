import React from 'react';
import { templateRegistryService } from '@/lib/services/templateRegistryService';
import { PublicTemplateMarketplaceClient } from '@/components/templates/marketplace/PublicTemplateMarketplaceClient';

export const dynamic = 'force-dynamic';

export default async function PublicTemplatesPage() {
  const templates = await templateRegistryService.getAllTemplates();

  return <PublicTemplateMarketplaceClient initialTemplates={templates} />;
}

