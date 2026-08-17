import React from 'react';
import dynamic from 'next/dynamic';
import { Trash2 } from 'lucide-react';
import { WindowState } from '@/components/os/hooks/useWindowManager';
import { AboutData } from '@/types/about';
import { ExperienceData } from '@/types/experience';
import { HardSkillsData } from '@/types/hardSkill';
import { Project } from '@/types/projects';
import { ContactData } from '@/types/contact';
import { ContactProfile } from '../data/mockChats';
import { getWindowPosition } from './positionSync';
import WindowSkeleton from '../ui/WindowSkeleton';

const AboutContent = dynamic(() => import('../windows/AboutContent'), {
  loading: () => <WindowSkeleton type="about" title="About Me" />,
  ssr: false,
});

const ChatWindow = dynamic(() => import('../windows/ChatWindow'), {
  loading: () => <WindowSkeleton type="generic" title="WhatsApp" />,
  ssr: false,
});

const ContactWindow = dynamic(() => import('../windows/ContactWindow'), {
  loading: () => <WindowSkeleton type="generic" title="Contact" />,
  ssr: false,
});

const ExplorerWindow = dynamic(() => import('../windows/ExplorerWindow'), {
  loading: () => <WindowSkeleton type="explorer" title="Project Explorer" />,
  ssr: false,
});

interface WindowFactoryProps {
  aboutData: AboutData | null | undefined;
  experienceData: ExperienceData | null | undefined;
  hardSkillsData: HardSkillsData | null | undefined;
  contactData: ContactData | null | undefined;
  siteId?: string;
  projects: Project[];
  dynamicContacts: Record<string, ContactProfile>;
  isAdmin?: boolean;
  isMobile?: boolean;
}

export const createInitialWindows = ({
  aboutData,
  experienceData,
  hardSkillsData,
  contactData,
  siteId = 'default-site',
  projects: _projects,
  dynamicContacts,
  isAdmin = false,
  isMobile = false,
}: WindowFactoryProps): WindowState[] => {
  // About window - pakai positionSync untuk get posisi
  const aboutPos = getWindowPosition(
    'about',
    aboutData?.windowPreferences?.about,
    { x: 100, y: 80, width: 900, height: 600 },
    isAdmin
  );

  return [
    {
      id: 'about',
      title: 'Finder: About Me',
      isOpen: isMobile ? false : true,
      zIndex: 10,
      noPadding: true,
      initialPosition: { x: aboutPos.x, y: aboutPos.y },
      width: aboutPos.width,
      height: aboutPos.height,
      content: null, // Defer to contentFactory for better consistency
      contentFactory: () => (
        <AboutContent
          aboutData={aboutData || undefined}
          experienceData={experienceData || undefined}
          hardSkillsData={hardSkillsData || undefined}
        />
      ),
    },
    {
      id: 'whatsapp',
      title: 'WhatsApp',
      isOpen: false,
      zIndex: 11,
      noPadding: true,
      initialPosition: { x: 200, y: 120 },
      width: 450,
      height: 600,
      content: null,
      contentFactory: () => (
        <ChatWindow customContacts={dynamicContacts} initialProjects={_projects} />
      ),
    },
    {
      id: 'contact',
      title: 'Contact',
      isOpen: false,
      zIndex: 12,
      noPadding: true,
      initialPosition: { x: 240, y: 100 },
      width: 520,
      height: 720,
      content: null,
      contentFactory: () => <ContactWindow initialData={contactData} siteId={siteId} />,
    },
    {
      id: 'trash-bin',
      title: 'Recycle Bin',
      isOpen: false,
      zIndex: 1,
      initialPosition: { x: 400, y: 250 },
      width: 400,
      height: 250,
      content: (
        <div className="flex h-full flex-col items-center justify-center p-4 text-center">
          <Trash2 size={48} className="mb-2 text-gray-400" />
          <h3 className="mb-1 text-lg font-bold">Access Denied</h3>
          <p className="text-sm text-gray-500">You cannot delete perfection.</p>
        </div>
      ),
    },
    {
      id: 'projects',
      title: 'Finder: Projects',
      isOpen: false,
      zIndex: 13,
      noPadding: true,
      initialPosition: { x: 50, y: 50 },
      width: 1000,
      height: 700,
      content: null,
      contentFactory: () => <ExplorerWindow isAdmin={isAdmin} />,
    },
    {
      id: 'explorer',
      title: 'Project Explorer',
      isOpen: false,
      zIndex: 14,
      noPadding: true,
      initialPosition: { x: 120, y: 120 },
      width: 900,
      height: 600,
      content: null,
      contentFactory: () => <ExplorerWindow isAdmin={isAdmin} />,
    },
  ];
};
