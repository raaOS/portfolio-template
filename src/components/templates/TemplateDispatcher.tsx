'use client';

import OSDesktopRenderer from '@/components/templates/os-desktop/OSDesktopRenderer';
import type { TemplateRendererProps } from '@/types/template';

export default function TemplateDispatcher(props: TemplateRendererProps) {
  const { data } = props;
  const activeKey = data.site.activeTemplateKey || 'os-desktop';

  switch (activeKey) {
    case 'os-desktop':
    default:
      return <OSDesktopRenderer {...props} />;
  }
}
