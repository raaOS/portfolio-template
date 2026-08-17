import type { Metadata } from 'next';
import { generateMetadata as generateSEOMetadata } from '@/lib/seo';
import CvPageClient from '@/app/(site)/cv/_components/CvPageClient';
import { loadAboutData } from '@/lib/about';
import { loadExperienceData } from '@/lib/experience';
import { loadHardSkillsData } from '@/lib/hardSkills';

export const metadata: Metadata = generateSEOMetadata({
  title: 'Resume | Portfolio Owner',
  description:
    'Resume versi ATS-friendly untuk screening cepat: ringkasan, skills, dan pengalaman.',
  path: '/cv',
});

// Selalu render dinamis agar data CV mengikuti perubahan data portofolio terbaru
export const revalidate = 3600;

export default async function CvPage() {
  const [aboutData, experienceData, hardSkillsData] = await Promise.all([
    loadAboutData(),
    loadExperienceData(),
    loadHardSkillsData(),
  ]);

  return (
    <CvPageClient
      aboutData={aboutData}
      experienceData={experienceData}
      hardSkillsData={hardSkillsData}
    />
  );
}
