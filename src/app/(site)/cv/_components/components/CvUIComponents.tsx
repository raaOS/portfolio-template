'use client';

import React from 'react';
import { CheckCircle2, FileText, Globe, Printer } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { localizeProject, localizeText } from '@/lib/i18n/contentLocalization';
import { DEFAULT_SITE_URL } from '@/lib/constants';
import type { WorkExperience } from '@/types/experience';
import type { HardSkillLevel } from '@/types/hardSkill';
import type { Project } from '@/types/projects';

interface SectionProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  accent?: boolean;
}

export const CvSection = ({ title, children, className = '', accent = false }: SectionProps) => (
  <div className={className}>
    <h2
      className={`mb-4 text-xs font-bold uppercase tracking-widest ${accent ? 'text-red-700' : 'text-gray-800'}`}
    >
      {title}
    </h2>
    {children}
  </div>
);

interface CvWebHeaderProps {
  displayName: string;
  headline: string;
  onPrint: () => void;
}

interface CvSkillItem {
  tool: string;
  level: HardSkillLevel;
  details: string[];
}

export const CvWebHeader = ({ displayName, headline, onPrint }: CvWebHeaderProps) => {
  const { locale } = useLanguage();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL;
  const displayUrl = siteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');

  return (
    <div className="no-print flex flex-col justify-between gap-6 border-b-2 border-black/5 pb-8 md:flex-row md:items-end">
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-red-100 bg-red-50 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-red-700">
          <FileText size={12} /> Curriculum Vitae
        </div>
        <h1 className="text-4xl font-black tracking-tighter text-gray-900 md:text-6xl">
          {displayName}
        </h1>
        <div className="flex flex-col gap-4">
          <p className="text-xl font-medium text-gray-500 md:text-2xl">{headline}</p>
          <a
            href={siteUrl}
            className="inline-flex w-fit items-center gap-2 rounded-md border border-gray-200 bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-800 no-underline shadow-sm transition-colors hover:bg-gray-200"
          >
            <Globe size={14} className="text-gray-500" />
            {displayUrl}
          </a>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onPrint}
          className="flex items-center gap-2 rounded-full bg-black px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-lg transition-all hover:scale-105 hover:bg-red-600 active:scale-95"
        >
          <Printer size={14} />
          {locale === 'en' ? 'Print / Save PDF' : 'Cetak / Simpan PDF'}
        </button>
      </div>
    </div>
  );
};

export const CvPrintHeader = ({
  displayName,
  headline,
}: {
  displayName: string;
  headline: string;
}) => {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL;
  const displayUrl = siteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');

  return (
    <div className="print-only hidden pb-4">
      <h1 className="text-3xl font-bold">{displayName}</h1>
      <p className="mb-3 text-lg text-gray-600">{headline}</p>
      <a
        href={siteUrl}
        className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-gray-100/80 px-3 py-1.5 text-sm font-medium text-gray-800 no-underline shadow-sm"
      >
        <Globe size={14} className="text-gray-500" />
        {displayUrl}
      </a>
    </div>
  );
};

export const CvSkills = ({
  hardSkills,
  softSkills,
}: {
  hardSkills: CvSkillItem[];
  softSkills: string[];
}) => {
  const { locale } = useLanguage();

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 print:grid-cols-2">
      <CvSection title="Hard Skills">
        {hardSkills.length > 0 ? (
          <ul className="mt-2 space-y-2 text-sm">
            {hardSkills.map(({ tool, level, details }) => (
              <li
                key={tool}
                className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-gray-800"
              >
                <div className="mb-1 flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-gray-900">{tool}</span>
                  <span className="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-xs font-medium text-gray-600">
                    {level}
                  </span>
                </div>
                {details.length > 0 && (
                  <div className="mt-1 text-xs text-gray-700 print:text-black">
                    {details.join(' / ')}
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-gray-600">
            {locale === 'en'
              ? 'Hard skills data is not available yet.'
              : 'Data hard skills belum tersedia.'}
          </p>
        )}
      </CvSection>

      <CvSection title="Soft Skills">
        {softSkills.length > 0 ? (
          <ul className="mt-2 space-y-2 text-sm">
            {softSkills.slice(0, 4).map((skill) => (
              <li
                key={skill}
                className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-800"
              >
                {skill}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-gray-600">
            {locale === 'en'
              ? 'Soft skills data is not available yet.'
              : 'Data soft skills belum tersedia.'}
          </p>
        )}
      </CvSection>
    </div>
  );
};

export const CvExperience = ({
  workExperience,
  chunkWords,
}: {
  workExperience: WorkExperience[];
  chunkWords: (t: string) => string[];
}) => {
  const { locale } = useLanguage();

  return (
    <CvSection
      title={locale === 'en' ? 'Experience' : 'Pengalaman'}
      className="print:break-before-page"
    >
      {workExperience.length > 0 ? (
        workExperience.map((exp, idx) => (
          <div
            key={`${exp.company}-${idx}`}
            className="mb-3 rounded-lg border border-gray-100 p-3 last:mb-0"
          >
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <div className="text-base font-semibold text-gray-900">
                {exp.position} - {exp.company}
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-700">
                <span>{exp.year}</span>
                {exp.duration && (
                  <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-gray-700">
                    {exp.duration}
                  </span>
                )}
              </div>
            </div>
            {exp.description?.length ? (
              <div className="mt-2 space-y-1 text-sm text-gray-700">
                {exp.description.slice(0, 4).map((item: string, dIdx: number) => (
                  <div key={dIdx} className="flex items-start gap-2">
                    <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-gray-400" />
                    <div className="space-y-1">
                      {chunkWords(item).map((chunk: string, cIdx: number) => (
                        <div key={cIdx}>{chunk}</div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ))
      ) : (
        <p className="text-sm text-gray-600">
          {locale === 'en'
            ? 'Experience data is not available yet.'
            : 'Data experience belum tersedia.'}
        </p>
      )}
    </CvSection>
  );
};

export const CvProjects = ({ topProjects }: { topProjects: Project[] }) => {
  const { locale } = useLanguage();

  return (
    <CvSection title={locale === 'en' ? 'Projects' : 'Proyek'}>
      {topProjects.length > 0 ? (
        <ul className="space-y-2">
          {topProjects.map((rawProject) => {
            const project = localizeProject(rawProject, locale);
            return (
              <li key={project.id} className="rounded-lg border border-gray-100 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-gray-900">{project.title}</span>
                  <span className="text-xs text-gray-600">{project.year || '-'}</span>
                </div>
                {project.description ? (
                  <p className="mt-1 text-sm text-gray-700">{project.description}</p>
                ) : null}
                {project.tags?.length ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {project.tags.slice(0, 4).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 text-xs text-gray-700"
                      >
                        {localizeText(tag, locale)}
                      </span>
                    ))}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-gray-600">
          {locale === 'en' ? 'No projects displayed yet.' : 'Belum ada proyek ditampilkan.'}
        </p>
      )}
    </CvSection>
  );
};
