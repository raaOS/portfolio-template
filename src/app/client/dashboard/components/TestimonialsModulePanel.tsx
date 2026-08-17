'use client';

import { FormEvent } from 'react';
import {
  FilePlus2,
  Loader2,
  Lock,
  MessageCircle,
  Pencil,
  Save,
  Trash2,
} from 'lucide-react';
import type { Testimonial } from '@/types/testimonial';
import type { ClientSiteSummary, TestimonialDraft } from '../ClientSelfServiceDashboard';

interface TestimonialsModulePanelProps {
  site: ClientSiteSummary | null;
  testimonials: Testimonial[];
  testimonialDraft: TestimonialDraft;
  isTestimonialEditorOpen: boolean;
  isBusy: boolean;
  isSiteActive: boolean;
  canUseTestimonials: boolean;
  testimonialLimit: number;
  isTestimonialLimitReached: boolean;
  isTestimonialDraftValid: boolean;
  setTestimonialDraft: React.Dispatch<React.SetStateAction<TestimonialDraft>>;
  startCreateTestimonial: () => void;
  startEditTestimonial: (testimonial: Testimonial) => void;
  closeTestimonialEditor: () => void;
  submitTestimonial: (e: FormEvent<HTMLFormElement>) => Promise<void>;
  deleteTestimonial: (testimonial: Testimonial) => Promise<void>;
}

export function TestimonialsModulePanel({
  site,
  testimonials,
  testimonialDraft,
  isTestimonialEditorOpen,
  isBusy,
  isSiteActive,
  canUseTestimonials,
  testimonialLimit,
  isTestimonialLimitReached,
  isTestimonialDraftValid,
  setTestimonialDraft,
  startCreateTestimonial,
  startEditTestimonial,
  closeTestimonialEditor,
  submitTestimonial,
  deleteTestimonial,
}: TestimonialsModulePanelProps) {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3">
        <div>
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-emerald-600" />
            <h2 className="text-sm font-semibold">WhatsApp Testimoni</h2>
          </div>
          <p className="mt-0.5 text-xs text-zinc-500">
            {canUseTestimonials
              ? `${testimonials.length}/${testimonialLimit} item Pro`
              : 'Tersedia untuk Pro'}
          </p>
        </div>
        {canUseTestimonials ? (
          <button
            type="button"
            onClick={startCreateTestimonial}
            disabled={!site || !isSiteActive || isTestimonialLimitReached || isBusy}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-zinc-950 px-3 text-xs font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
          >
            <FilePlus2 className="h-4 w-4" />
            Testimoni Baru
          </button>
        ) : (
          <span className="inline-flex h-8 items-center gap-2 rounded-md border border-zinc-200 px-3 text-xs font-semibold text-zinc-500">
            <Lock className="h-4 w-4" />
            Pro
          </span>
        )}
      </div>

      {!canUseTestimonials ? (
        <div className="flex min-h-32 flex-col items-center justify-center px-4 py-8 text-center">
          <Lock className="mb-3 h-5 w-5 text-zinc-400" />
          <p className="text-sm font-medium text-zinc-700">WhatsApp Testimoni terkunci</p>
          <p className="mt-1 max-w-sm text-xs text-zinc-500">
            Upgrade site ini ke Pro untuk mengatur chat testimoni yang tampil di Dock WhatsApp.
          </p>
        </div>
      ) : (
        <div>
          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-0 text-sm">
              <thead>
                <tr className="bg-zinc-50 text-left text-xs font-semibold uppercase text-zinc-500">
                  <th className="border-b border-zinc-200 px-4 py-3">Nama</th>
                  <th className="border-b border-zinc-200 px-4 py-3">Preview</th>
                  <th className="border-b border-zinc-200 px-4 py-3">Status</th>
                  <th className="border-b border-zinc-200 px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {testimonials.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center text-zinc-500">
                      Testimoni belum tersedia
                    </td>
                  </tr>
                ) : (
                  testimonials.map((testimonial) => (
                    <tr key={testimonial.id} className="hover:bg-zinc-50">
                      <td className="border-b border-zinc-100 px-4 py-3">
                        <div className="font-medium">{testimonial.name}</div>
                        <div className="text-xs text-zinc-500">
                          {[testimonial.role, testimonial.company]
                            .filter(Boolean)
                            .join(' / ') || 'Client'}
                        </div>
                      </td>
                      <td className="max-w-xs border-b border-zinc-100 px-4 py-3">
                        <div className="truncate text-zinc-700">
                          {testimonial.notificationText}
                        </div>
                      </td>
                      <td className="border-b border-zinc-100 px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-semibold ${
                            testimonial.isActive === false
                              ? 'bg-zinc-100 text-zinc-500'
                              : 'bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          {testimonial.isActive === false ? 'hidden' : 'active'}
                        </span>
                      </td>
                      <td className="border-b border-zinc-100 px-4 py-3">
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => startEditTestimonial(testimonial)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-950"
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void deleteTestimonial(testimonial)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {isTestimonialEditorOpen && (
            <form onSubmit={submitTestimonial} className="border-t border-zinc-200">
              <div className="grid gap-4 p-4 md:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-medium text-zinc-600">Nama client</span>
                  <input
                    value={testimonialDraft.name}
                    onChange={(event) =>
                      setTestimonialDraft((prev) => ({ ...prev, name: event.target.value }))
                    }
                    className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none transition focus:border-zinc-400"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-zinc-600">Preview notifikasi</span>
                  <input
                    value={testimonialDraft.notificationText}
                    onChange={(event) =>
                      setTestimonialDraft((prev) => ({
                        ...prev,
                        notificationText: event.target.value,
                      }))
                    }
                    className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none transition focus:border-zinc-400"
                    placeholder="Project sudah sesuai, terima kasih."
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-zinc-600">Role</span>
                  <input
                    value={testimonialDraft.role}
                    onChange={(event) =>
                      setTestimonialDraft((prev) => ({ ...prev, role: event.target.value }))
                    }
                    className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none transition focus:border-zinc-400"
                    placeholder="Founder"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-zinc-600">Company</span>
                  <input
                    value={testimonialDraft.company}
                    onChange={(event) =>
                      setTestimonialDraft((prev) => ({
                        ...prev,
                        company: event.target.value,
                      }))
                    }
                    className="mt-1 h-10 w-full rounded-md border border-zinc-200 px-3 text-sm outline-none transition focus:border-zinc-400"
                    placeholder="Studio Client"
                  />
                </label>
                <label className="block md:col-span-2">
                  <span className="text-xs font-medium text-zinc-600">Isi ringkas</span>
                  <textarea
                    value={testimonialDraft.content}
                    onChange={(event) =>
                      setTestimonialDraft((prev) => ({
                        ...prev,
                        content: event.target.value,
                      }))
                    }
                    className="mt-1 min-h-20 w-full resize-none rounded-md border border-zinc-200 px-3 py-2 text-sm outline-none transition focus:border-zinc-400"
                    placeholder="Kalimat testimoni utama jika chat kosong."
                  />
                </label>
                <label className="block md:col-span-2">
                  <span className="text-xs font-medium text-zinc-600">Chat WhatsApp</span>
                  <textarea
                    value={testimonialDraft.messagesText}
                    onChange={(event) =>
                      setTestimonialDraft((prev) => ({
                        ...prev,
                        messagesText: event.target.value,
                      }))
                    }
                    className="mt-1 min-h-36 w-full resize-y rounded-md border border-zinc-200 px-3 py-2 font-mono text-xs outline-none transition focus:border-zinc-400"
                    placeholder={`Client: Halo, hasilnya sudah sesuai.\nSaya: Terima kasih, senang bisa bantu.\nClient: Tim kami suka flow-nya.`}
                  />
                </label>
                <label className="flex items-center gap-2 text-xs font-medium text-zinc-700">
                  <input
                    type="checkbox"
                    checked={testimonialDraft.isActive}
                    onChange={(event) =>
                      setTestimonialDraft((prev) => ({
                        ...prev,
                        isActive: event.target.checked,
                      }))
                    }
                    className="h-4 w-4 rounded border-zinc-300"
                  />
                  Tampilkan di public site
                </label>
              </div>
              <div className="flex justify-end gap-2 border-t border-zinc-200 p-4">
                <button
                  type="button"
                  onClick={closeTestimonialEditor}
                  className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-200 px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isBusy || !isSiteActive || !isTestimonialDraftValid}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
                >
                  {isBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Simpan Testimoni
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
