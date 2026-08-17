'use client';

import { FormEvent } from 'react';
import { FilePlus2, Loader2, Save, Trash2 } from 'lucide-react';
import type {
  ClientContentDraft,
  ClientContentProfile,
  HardSkillLevel,
} from '../ClientSelfServiceDashboard';

interface ContentModulePanelProps {
  contentDraft: ClientContentDraft;
  isBusy: boolean;
  isSiteActive: boolean;
  isContentLoaded: boolean;
  isContentDraftValid: boolean;
  setContentDraft: React.Dispatch<React.SetStateAction<ClientContentDraft>>;
  createWorkExperienceDraft: () => ClientContentDraft['workExperience'][number];
  createHardSkillDraft: () => ClientContentDraft['hardSkills'][number];
  submitContent: (e: FormEvent<HTMLFormElement>) => Promise<void>;
}

export function ContentModulePanel({
  contentDraft,
  isBusy,
  isSiteActive,
  isContentLoaded,
  isContentDraftValid,
  setContentDraft,
  createWorkExperienceDraft,
  createHardSkillDraft,
  submitContent,
}: ContentModulePanelProps) {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">Konten Profil</h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            Lite & Pro / profil, kontak, statistik, pengalaman, dan hard skills.
          </p>
        </div>
        <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
          Self-service
        </span>
      </div>

      <form onSubmit={submitContent}>
        <div className="space-y-4 p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-zinc-600">Judul hero</span>
              <input
                value={contentDraft.profile.heroTitle}
                onChange={(event) =>
                  setContentDraft((prev) => ({
                    ...prev,
                    profile: { ...prev.profile, heroTitle: event.target.value },
                  }))
                }
                className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none transition focus:border-zinc-400"
                placeholder="PORTFOLIO"
              />
            </label>
            <div className="grid grid-cols-[140px_minmax(0,1fr)] gap-3">
              <label className="block">
                <span className="text-xs font-medium text-zinc-600">Status</span>
                <select
                  value={contentDraft.profile.availabilityStatus}
                  onChange={(event) =>
                    setContentDraft((prev) => ({
                      ...prev,
                      profile: {
                        ...prev.profile,
                        availabilityStatus: event.target
                          .value as ClientContentProfile['availabilityStatus'],
                      },
                    }))
                  }
                  className="mt-1 h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none transition focus:border-zinc-400"
                >
                  <option value="available">available</option>
                  <option value="limited">limited</option>
                  <option value="booked">booked</option>
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-zinc-600">Teks status</span>
                <input
                  value={contentDraft.profile.availabilityText}
                  onChange={(event) =>
                    setContentDraft((prev) => ({
                      ...prev,
                      profile: { ...prev.profile, availabilityText: event.target.value },
                    }))
                  }
                  className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none transition focus:border-zinc-400"
                />
              </label>
            </div>
            <label className="block md:col-span-2">
              <span className="text-xs font-medium text-zinc-600">Bio</span>
              <textarea
                value={contentDraft.profile.bio}
                onChange={(event) =>
                  setContentDraft((prev) => ({
                    ...prev,
                    profile: { ...prev.profile, bio: event.target.value },
                  }))
                }
                className="mt-1 min-h-28 w-full resize-y rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none transition focus:border-zinc-400"
                placeholder="Profil singkat yang tampil di public site."
              />
            </label>
            {([
              ['mottoBadge', 'Badge motto'],
              ['mottoQuote', 'Quote motto'],
              ['email', 'Email'],
              ['whatsapp', 'WhatsApp'],
              ['linkedin', 'LinkedIn'],
              ['phone', 'Phone'],
            ] as const).map(([key, label]) => (
              <label key={key} className="block">
                <span className="text-xs font-medium text-zinc-600">{label}</span>
                <input
                  value={contentDraft.profile[key]}
                  onChange={(event) =>
                    setContentDraft((prev) => ({
                      ...prev,
                      profile: { ...prev.profile, [key]: event.target.value },
                    }))
                  }
                  className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none transition focus:border-zinc-400"
                />
              </label>
            ))}
            <label className="block md:col-span-2">
              <span className="text-xs font-medium text-zinc-600">Address</span>
              <input
                value={contentDraft.profile.address}
                onChange={(event) =>
                  setContentDraft((prev) => ({
                    ...prev,
                    profile: { ...prev.profile, address: event.target.value },
                  }))
                }
                className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none transition focus:border-zinc-400"
              />
            </label>
            {([
              ['instagram', 'Instagram'],
              ['behance', 'Behance'],
              ['contactHeadline', 'Headline contact'],
              ['contactSubtext', 'Subtext contact'],
            ] as const).map(([key, label]) => (
              <label key={key} className="block">
                <span className="text-xs font-medium text-zinc-600">{label}</span>
                <input
                  value={contentDraft.profile[key]}
                  onChange={(event) =>
                    setContentDraft((prev) => ({
                      ...prev,
                      profile: { ...prev.profile, [key]: event.target.value },
                    }))
                  }
                  className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none transition focus:border-zinc-400"
                />
              </label>
            ))}
          </div>

          {/* Statistics */}
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
            <div className="mb-3 text-xs font-semibold uppercase text-zinc-500">Statistik</div>
            <div className="grid gap-3 md:grid-cols-4">
              {([
                ['years', 'Years'],
                ['projects', 'Projects'],
                ['designTools', 'Design tools'],
                ['clientSatisfaction', 'Satisfaction'],
              ] as const).map(([key, label]) => (
                <label key={key} className="block">
                  <span className="text-xs font-medium text-zinc-600">{label}</span>
                  <input
                    value={contentDraft.statistics[key]}
                    onChange={(event) =>
                      setContentDraft((prev) => ({
                        ...prev,
                        statistics: { ...prev.statistics, [key]: event.target.value },
                      }))
                    }
                    className="mt-1 h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none transition focus:border-zinc-400"
                  />
                </label>
              ))}
            </div>
          </div>

          {/* Work Experience */}
          <div className="rounded-lg border border-zinc-200">
            <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-3 py-3">
              <div>
                <h3 className="text-xs font-semibold uppercase text-zinc-600">Pengalaman</h3>
                <p className="mt-0.5 text-xs text-zinc-500">Deskripsi satu baris per poin.</p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setContentDraft((prev) => ({
                    ...prev,
                    workExperience: [...prev.workExperience, createWorkExperienceDraft()],
                  }))
                }
                className="inline-flex h-8 items-center gap-2 rounded-md border border-zinc-200 px-3 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50"
              >
                <FilePlus2 className="h-4 w-4" />
                Tambah
              </button>
            </div>
            <div className="space-y-3 p-3">
              {contentDraft.workExperience.length === 0 ? (
                <p className="py-6 text-center text-sm text-zinc-500">Belum ada pengalaman.</p>
              ) : (
                contentDraft.workExperience.map((item, index) => (
                  <div key={item.id || index} className="rounded-md border border-zinc-200 p-3">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <label className="flex items-center gap-2 text-xs font-medium text-zinc-700">
                        <input
                          type="checkbox"
                          checked={item.isActive}
                          onChange={(event) =>
                            setContentDraft((prev) => ({
                              ...prev,
                              workExperience: prev.workExperience.map((entry, itemIndex) =>
                                itemIndex === index ? { ...entry, isActive: event.target.checked } : entry
                              ),
                            }))
                          }
                          className="h-4 w-4 rounded border-zinc-300"
                        />
                        Tampilkan
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          setContentDraft((prev) => ({
                            ...prev,
                            workExperience: prev.workExperience.filter((_, itemIndex) => itemIndex !== index),
                          }))
                        }
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition hover:bg-red-50 hover:text-red-600"
                        title="Hapus pengalaman"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      {([
                        ['company', 'Company'],
                        ['position', 'Position'],
                        ['year', 'Year'],
                        ['duration', 'Duration'],
                        ['imageUrl', 'Image URL'],
                      ] as const).map(([key, label]) => (
                        <label key={key} className={key === 'imageUrl' ? 'block md:col-span-2' : 'block'}>
                          <span className="text-xs font-medium text-zinc-600">{label}</span>
                          <input
                            value={item[key]}
                            onChange={(event) =>
                              setContentDraft((prev) => ({
                                ...prev,
                                workExperience: prev.workExperience.map((entry, itemIndex) =>
                                  itemIndex === index ? { ...entry, [key]: event.target.value } : entry
                                ),
                              }))
                            }
                            className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none transition focus:border-zinc-400"
                          />
                        </label>
                      ))}
                      <label className="block md:col-span-2">
                        <span className="text-xs font-medium text-zinc-600">Description</span>
                        <textarea
                          value={item.descriptionText}
                          onChange={(event) =>
                            setContentDraft((prev) => ({
                              ...prev,
                              workExperience: prev.workExperience.map((entry, itemIndex) =>
                                itemIndex === index ? { ...entry, descriptionText: event.target.value } : entry
                              ),
                            }))
                          }
                          className="mt-1 min-h-24 w-full resize-y rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none transition focus:border-zinc-400"
                        />
                      </label>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Hard Skills */}
          <div className="rounded-lg border border-zinc-200">
            <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-3 py-3">
              <div>
                <h3 className="text-xs font-semibold uppercase text-zinc-600">Hard Skills</h3>
                <p className="mt-0.5 text-xs text-zinc-500">Nama, level, deskripsi, dan visibility.</p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setContentDraft((prev) => ({
                    ...prev,
                    hardSkills: [...prev.hardSkills, createHardSkillDraft()],
                  }))
                }
                className="inline-flex h-8 items-center gap-2 rounded-md border border-zinc-200 px-3 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50"
              >
                <FilePlus2 className="h-4 w-4" />
                Tambah
              </button>
            </div>
            <div className="space-y-3 p-3">
              {contentDraft.hardSkills.length === 0 ? (
                <p className="py-6 text-center text-sm text-zinc-500">Belum ada hard skill.</p>
              ) : (
                contentDraft.hardSkills.map((skill, index) => (
                  <div key={skill.id || index} className="rounded-md border border-zinc-200 p-3">
                    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_150px]">
                      <label className="block">
                        <span className="text-xs font-medium text-zinc-600">Name</span>
                        <input
                          value={skill.name}
                          onChange={(event) =>
                            setContentDraft((prev) => ({
                              ...prev,
                              hardSkills: prev.hardSkills.map((entry, itemIndex) =>
                                itemIndex === index ? { ...entry, name: event.target.value } : entry
                              ),
                            }))
                          }
                          className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none transition focus:border-zinc-400"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs font-medium text-zinc-600">Level</span>
                        <select
                          value={skill.level}
                          onChange={(event) =>
                            setContentDraft((prev) => ({
                              ...prev,
                              hardSkills: prev.hardSkills.map((entry, itemIndex) =>
                                itemIndex === index
                                  ? { ...entry, level: event.target.value as HardSkillLevel }
                                  : entry
                              ),
                            }))
                          }
                          className="mt-1 h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none transition focus:border-zinc-400"
                        >
                          <option value="Beginner">Beginner</option>
                          <option value="Intermediate">Intermediate</option>
                          <option value="Advanced">Advanced</option>
                          <option value="Expert">Expert</option>
                        </select>
                      </label>
                      <label className="block md:col-span-2">
                        <span className="text-xs font-medium text-zinc-600">Description</span>
                        <input
                          value={skill.description}
                          onChange={(event) =>
                            setContentDraft((prev) => ({
                              ...prev,
                              hardSkills: prev.hardSkills.map((entry, itemIndex) =>
                                itemIndex === index ? { ...entry, description: event.target.value } : entry
                              ),
                            }))
                          }
                          className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none transition focus:border-zinc-400"
                        />
                      </label>
                      <label className="block md:col-span-2">
                        <span className="text-xs font-medium text-zinc-600">Icon URL</span>
                        <input
                          value={skill.iconUrl}
                          onChange={(event) =>
                            setContentDraft((prev) => ({
                              ...prev,
                              hardSkills: prev.hardSkills.map((entry, itemIndex) =>
                                itemIndex === index ? { ...entry, iconUrl: event.target.value } : entry
                              ),
                            }))
                          }
                          className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none transition focus:border-zinc-400"
                        />
                      </label>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <label className="flex items-center gap-2 text-xs font-medium text-zinc-700">
                        <input
                          type="checkbox"
                          checked={skill.isActive}
                          onChange={(event) =>
                            setContentDraft((prev) => ({
                              ...prev,
                              hardSkills: prev.hardSkills.map((entry, itemIndex) =>
                                itemIndex === index ? { ...entry, isActive: event.target.checked } : entry
                              ),
                            }))
                          }
                          className="h-4 w-4 rounded border-zinc-300"
                        />
                        Tampilkan
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          setContentDraft((prev) => ({
                            ...prev,
                            hardSkills: prev.hardSkills.filter((_, itemIndex) => itemIndex !== index),
                          }))
                        }
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition hover:bg-red-50 hover:text-red-600"
                        title="Hapus skill"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-zinc-200 p-4">
          <button
            type="submit"
            disabled={isBusy || !isSiteActive || !isContentLoaded || !isContentDraftValid}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
          >
            {isBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Simpan Konten
          </button>
        </div>
      </form>
    </div>
  );
}
