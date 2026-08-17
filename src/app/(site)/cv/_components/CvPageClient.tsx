'use client';

import { useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import type { AboutData } from '@/types/about';
import type { ExperienceData } from '@/types/experience';
import type { HardSkillsData } from '@/types/hardSkill';
import SystemNavFrame from '@/components/layout/SystemNavFrame';
import { useLanguage } from '@/contexts/LanguageContext';
import { localizeText, localizeWorkExperience } from '@/lib/i18n/contentLocalization';

// Extracted Sub-components & Hook
import { useCvExport } from './hooks/useCvExport';
import {
  CvSection,
  CvWebHeader,
  CvPrintHeader,
  CvSkills,
  CvExperience,
} from './components/CvUIComponents';

type Props = {
  aboutData: AboutData | null;
  experienceData: ExperienceData | null;
  hardSkillsData: HardSkillsData | null;
};

export default function CvPageClient({ aboutData, experienceData, hardSkillsData }: Props) {
  const { locale } = useLanguage();
  const searchParams = useSearchParams();
  const shouldAutoPrint = searchParams?.get('print') === 'true';
  const cvRef = useRef<HTMLDivElement>(null);

  const displayName = 'Portfolio Owner';
  const headline = 'Creative Professional';
  const summary = localizeText(
    aboutData?.professional?.bio?.content ??
      'Desainer Grafis senior dengan fokus pada solusi visual yang strategis dan berdampak nyata.',
    locale
  );

  const { handlePrint } = useCvExport({ cvRef, displayName });

  useEffect(() => {
    if (shouldAutoPrint) {
      const timer = setTimeout(() => {
        window.print();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [shouldAutoPrint]);

  const chunkWords = (text: string, size = 10) => {
    const words = text.split(/\s+/).filter(Boolean);
    const chunks: string[] = [];
    for (let i = 0; i < words.length; i += size) {
      chunks.push(words.slice(i, i + size).join(' '));
    }
    return chunks;
  };

  const softSkills = useMemo(
    () => (aboutData?.softSkills?.texts ?? []).map((skill) => localizeText(skill, locale)),
    [aboutData?.softSkills?.texts, locale]
  );
  const hardSkills = useMemo(() => {
    const skills = hardSkillsData?.skills || [];
    return skills
      .filter((s) => s.isActive !== false)
      .slice(0, 10)
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map((s) => ({
        tool: s.name,
        level: s.level,
        details: (s.details || []).map((detail) => localizeText(detail, locale)),
      }));
  }, [hardSkillsData, locale]);

  const workExperience = useMemo(
    () => (experienceData?.workExperience ?? []).map((job) => localizeWorkExperience(job, locale)),
    [experienceData?.workExperience, locale]
  );

  return (
    <SystemNavFrame>
      <div className="min-h-screen bg-[#F0F0F0] text-gray-900 selection:bg-red-100 selection:text-red-900">
        <style>{`
          @media print {
            @page {
              size: auto;
              margin: 0mm;
            }
            body {
              background: white !important;
              margin: 15mm 20mm !important;
            }
            .no-print { display: none !important; }
            .print-only { display: block !important; }
            .cv-container { box-shadow: none !important; border: none !important; padding: 0 !important; margin: 0 !important; max-width: 100% !important; }
            .cv-section { border-color: #eee !important; background: transparent !important; }
          }
          @media screen {
            .print-only { display: none !important; }
          }
        `}</style>

        <div className="cv-container container mx-auto max-w-4xl space-y-8 px-4 py-12 md:py-20">
          <CvWebHeader displayName={displayName} headline={headline} onPrint={handlePrint} />

          <CvPrintHeader displayName={displayName} headline={headline} />

          <section
            ref={cvRef}
            className="cv-section relative overflow-hidden rounded-3xl border-2 border-black/5 bg-white p-6 shadow-xl md:border-black/5 md:p-10"
          >
            <div className="no-print pointer-events-none absolute right-0 top-0 -mr-16 -mt-16 h-32 w-32 rounded-full bg-red-50/50 blur-3xl" />

            <div className="relative z-10 space-y-10">
              <CvSection
                title={locale === 'en' ? 'Professional Summary' : 'Ringkasan Profesional'}
                accent
              >
                <p className="text-sm font-medium leading-relaxed text-gray-700 md:text-base">
                  {summary}
                </p>
              </CvSection>

              <CvSkills hardSkills={hardSkills} softSkills={softSkills} />

              <CvExperience workExperience={workExperience} chunkWords={chunkWords} />
            </div>
          </section>
        </div>
      </div>
    </SystemNavFrame>
  );
}
