# AI INDEX TRACKER

**MANDATORY RULE UNTUK SEMUA AI AGENT:**

> Jangan membaca seluruh codebase atau PRD secara sembarangan. Jika Anda baru memulai sesi, baca file ini untuk mengetahui status proyek, lalu BUKA HANYA file log yang relevan di folder `logs/`. Setelah selesai bekerja, perbarui file log yang relevan.

## 📌 Status Global Proyek

**Arsitektur Saat Ini: Managed Service (1-customer-1-account)**

- 1 customer = 1 Cloudflare account → 1 D1 + 1 R2 + 1 deployment
- Owner deploy template + CRUD ke akun customer via Wrangler CLI
- Customer dapat admin panel (macOS desktop style) untuk kelola konten
- SITE_ID hardcoded per deployment, tidak ada multi-site resolution

**Fase Saat Ini:** Fondasi managed service selesai (Sprint 75+). Admin panel customer fungsional, demo content termigrasi (Sprint 79), audit keamanan 2026-08-11 closed (2026-09-13).
**Tugas Aktif (Backlog):** Kosong — reset password customer kini **hanya jalur owner-assisted** (CLI `reset-customer-password.ts`); fitur self-service reset sudah dihapus (v1.3.14) dan seluruh jejaknya dibersihkan dari dokumen (v1.3.16/v1.3.17). Login customer = `/admin/login`; tidak ada login per-site, tidak ada dashboard master multi-klien (`/admin/client-dashboard` dihapus v1.3.20). Konsep owner dashboard terjawab sebagai Client Status Board di portal owner (Sprint 88, tools owner-side — lihat catatan arsitektur). Item backlog lama yang usang: ~~owner dashboard~~ (dihapus Sprint 75/78, digantikan Status Board Sprint 88), ~~customer dashboard~~ (selesai Sprint 75–78), ~~content migration~~ (selesai Sprint 79).

> **ARCHIVED (Sprint 0-74):** Sprint lama mencatat evolusi dari portofolio pribadi → multi-tenant SaaS → managed service. Log sprint lama masih relevan untuk memahami _why_ keputusan desain, tapi kode dan arsitektur yang dijelaskan sudah **tidak merepresentasikan kondisi terkini**. AI wajib merujuk Sprint 75+ untuk arsitektur current.

## 📂 Daftar Modul / Log Pekerjaan (Logs)

Berikut adalah daftar aktivitas yang telah atau sedang dikerjakan. Pilih log yang sesuai dengan permintaan user:

1. **[Sprint 0 - Cleanup Firebase](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_0_cleanup.md)**
   - _Status:_ 🟢 Completed
   - _Isi:_ Log penghapusan env, script, dependency, dan import Firebase dari proyek.
2. **[Sprint A - Context Pack AI](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_a_context.md)**
   - _Status:_ 🟢 Completed
   - _Isi:_ Ekstraksi PRD menjadi 9 file spesifik di docs/agent-context/.
3. **[Sprint B - D1/R2 Backend Hardening](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_b_d1_hardening.md)**
   - _Status:_ 🟢 Completed
   - _Isi:_ Setup DDL schema SQL relasional (7 tabel) di `src/lib/d1-schema.ts`.
4. **[Sprint C - Frontend Data Adapters](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_c_adapters.md)**
   - _Status:_ 🟢 Completed
   - _Isi:_ Pola Dual-Write diaktifkan. Pembuatan DAL SQL dan Mapper UI.
5. **[Sprint D - Backend Integration & Cleanup](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_d_integration.md)**
   - _Status:_ 🟢 Completed
   - _Isi:_ Melengkapi READ SQL dan mengalihkan routing API `projects` ke SQL.
6. **[Sprint E - Frontend UI Migration & Cleanup](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_e_frontend.md)**
   - _Status:_ 🟢 Completed
   - _Isi:_ Memperbaiki _bug_ posisi ikon (_overlap_) dengan mengatur ulang _spacing_ Grid dan mengubah urutan slot (ala macOS).

## 🛠️ Aturan Pengisian Log

Jika membuat modul atau sprint baru:

1. Buat file baru di dalam `logs/` dengan menyalin format dari `logs/template_log.md`.
2. Tambahkan link file tersebut ke daftar di atas.

## Audit Tambahan

7. **[V6 Completion Audit](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_v6_completion_audit.md)**
   - _Status:_ ✅ Resolved ( oleh Sprint 5 )
   - _Isi:_ Audit klaim selesai 100%; menemukan multi-tenant, public API `siteSlug`, migrasi UI SQL, dan test API projects belum selesai. Semua gap sudah ditutup oleh Sprint 5 (multi-tenancy D1/KV, SQL loader migration, dynamic routing `[siteSlug]`, public API).
8. **[Cloudflare Product Decision Lock](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/cloudflare_product_decision_lock.md)**
   - _Status:_ Completed
   - _Isi:_ Mengunci keputusan full Cloudflare, Lite/Pro self-service, dan peran CRUD Master agar AI baru tidak salah asumsi Vercel/admin-only.
9. **[Sprint 1 - Product Boundary Cleanup](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_1_product_boundary_cleanup.md)**
   - _Status:_ Completed
   - _Isi:_ Membersihkan kontrak env produk dan menghapus integrasi personal lama dari repo template.
10. **[Sprint 2 - Cloudflare Product Bootstrap](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_2_cloudflare_product_bootstrap.md)**
    - _Status:_ Completed
    - _Isi:_ Menyiapkan kontrak env Cloudflare produk, guard live write, doctor offline, bootstrap schema, dan seed demo aman.
11. **[Sprint 3 - Template Personal Data Cleanup](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_3_template_personal_data_cleanup.md)**
    - _Status:_ Completed
    - _Isi:_ Membersihkan data pribadi/default legacy, mengganti brand ke Portfolio OS, menstandarkan AI env produk, dan menghapus runtime aktif Vercel.
12. **[Sprint 4 - Cloudflare Workers Deploy Scaffold](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_4_cloudflare_workers_deploy_scaffold.md)**
    - _Status:_ Completed and locally verified
    - _Isi:_ Menambahkan OpenNext/Wrangler deploy scaffold, memindahkan middleware ke Edge entry, membersihkan blocker runtime Workers, memasang pre-deploy guard Cloudflare, dan memverifikasi `cf:build` + local `wrangler dev` HTTP 200.
13. **[Sprint 5 - V6 Multi-tenancy & SQL Loader Migration](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_5_v6_multi_tenancy.md)**
    - _Status:_ 🟢 Completed
    - _Isi:_ Implementasi multi-tenant database & KV, migrasi project loaders ke D1 SQL relational, dynamic routing public API, dan UI setup `/[siteSlug]`.
14. **[Sprint 6 - Production Smoke Deploy](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_6_production_smoke_deploy.md)**
    - _Status:_ Completed
    - _Isi:_ Optimasi bundle Worker, R2 binding runtime, direct upload Worker, patch OpenNext runtime, health check Cloudflare, deploy production, dan smoke test production.
15. **[Sprint 7 - Client Dashboard CRUD Hardening](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_7_client_dashboard_crud_hardening.md)**
    - _Status:_ Completed
    - _Isi:_ Mengalihkan CRUD project admin/client ke D1 SQL site-aware, menambahkan quota Lite/Pro, menghapus hook Telegram personal dari CRUD project, dan memverifikasi build Cloudflare.
16. **[Sprint 8 - Client Dashboard UI](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_8_client_dashboard_ui.md)**
    - _Status:_ Completed
    - _Isi:_ Menambahkan UI dashboard client self-service di admin desktop, endpoint admin sites, site-aware CRUD ringan, fix deep-link window, dan verifikasi browser + Cloudflare build.
17. **[Sprint 9 - Site-Scoped Project Media Upload](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_9_site_scoped_project_media_upload.md)**
    - _Status:_ Completed
    - _Isi:_ Menambahkan endpoint upload cover project scoped ke `sites/{siteId}/projects/covers/`, integrasi upload di Client Dashboard, test endpoint, dan verifikasi Cloudflare build + browser QA.
18. **[Sprint 10 - Site Storage Quota Enforcement](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_10_site_storage_quota.md)**
    - _Status:_ Completed
    - _Isi:_ Menghitung usage R2 per site prefix, menambahkan `usage.storage`, menegakkan quota `storageMb` untuk upload cover, dan menampilkan card Storage quota di Client Dashboard.
19. **[Sprint 11 - Client Gallery Image Upload](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_11_client_gallery_upload.md)**
    - _Status:_ Completed
    - _Isi:_ Menambahkan endpoint upload gallery image site-scoped, multi-upload gallery di Client Dashboard, mapping metadata `gallery`, quota storage, dan verifikasi Cloudflare build + browser QA.
20. **[Sprint 12 - Project Media Lifecycle Cleanup](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_12_project_media_lifecycle_cleanup.md)**
    - _Status:_ Completed
    - _Isi:_ Menambahkan cleanup R2 site-scoped saat project media diganti atau project dihapus, plus test safety prefix dan service wiring.
21. **[Sprint 13 - Site Project Media Audit](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_13_site_project_media_audit.md)**
    - _Status:_ Completed
    - _Isi:_ Menambahkan audit tool D1/R2 untuk prefix `sites/*/projects/`, guarded orphan deletion, dan verifikasi ulang test/build yang sebelumnya blocked.
22. **[Sprint 14 - Master Site Lite/Pro Management](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_14_master_site_management.md)**
    - _Status:_ Completed
    - _Isi:_ Menambahkan CRUD Master aman untuk create/update site, upgrade/downgrade Lite/Pro, suspend/activate site, dan UI Master Site di Client Dashboard.
23. **[Sprint 15 - Client Access Auth & Self-Service Dashboard](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_15_client_access_auth.md)**
    - _Status:_ Completed
    - _Isi:_ Menambahkan auth client site-scoped, endpoint login/check/logout client, UI akses client di Master, dan halaman `/client/login` + `/client/dashboard`.
24. **[Sprint 16 - Safe Site Delete](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_16_safe_site_delete.md)**
    - _Status:_ Completed
    - _Isi:_ Menambahkan hard delete site aman dengan konfirmasi slug, cleanup D1, dan delete media R2 hanya pada prefix `sites/{siteId}/`.
25. **[Sprint 17 - Video Gallery Direct Upload](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_17_video_gallery_direct_upload.md)**
    - _Status:_ Completed
    - _Isi:_ Menambahkan presign/direct upload video gallery site-scoped, alias client upload, whitelist signed-token direct upload, dan preview video di dashboard.
26. **[Sprint 18 - Plan & Billing Hardening](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_18_plan_billing_hardening.md)**
    - _Status:_ Completed
    - _Isi:_ Menambahkan metadata subscription/billing, field billing Master Site, dan guard downgrade Lite berbasis usage quota.
27. **[Sprint 19 - Production Readiness & Full Cloudflare Smoke Test](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_19_production_readiness.md)**
    - _Status:_ Completed
    - _Isi:_ Menambahkan gate `cf:readiness`, memverifikasi env/D1/R2/Wrangler/FFmpeg/plan quota, membersihkan warning Worker vendor output, dan smoke test Next + Wrangler lokal.
28. **[Sprint 20 - Release Packaging & Buyer Onboarding](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_20_release_packaging.md)**
    - _Status:_ Completed
    - _Isi:_ Menambahkan README, buyer onboarding, seller release checklist, matriks Lite/Pro, dan audit `release:audit` untuk paket jual full Cloudflare.
29. **[Sprint 21 - Production Deploy Runbook & First Release Candidate](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_21_production_deploy_runbook_rc.md)**
    - _Status:_ Completed
    - _Isi:_ Menambahkan production deploy runbook, RC1 release notes, production smoke script `release:smoke`, dan fix fallback R2 dev untuk `/r2/ffmpeg/*`.
30. **[Sprint 22 - Production Deploy & Smoke](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_22_production_deploy.md)**
    - _Status:_ Completed
    - _Isi:_ Menjalankan production deploy Cloudflare, memperbaiki blocker ukuran Worker Free dengan admin client-only panels + Wrangler minify, dan memverifikasi production smoke `8/8`.
31. **[Sprint 23 - Header PIN Entry Cleanup](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_23_header_pin_cleanup.md)**
    - _Status:_ Completed
    - _Isi:_ Menghapus modal PIN legacy dari klik Lottie mata di header public dan desktop OS menubar; ikon sekarang langsung menuju login admin.
32. **[Sprint 24 - Client Preview Guard](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_24_client_preview_guard.md)**
    - _Status:_ Completed
    - _Isi:_ Menonaktifkan link `Preview site` sampai site aktif punya minimal 1 project published, dan mengganti card preview menjadi empty state saat project masih 0.
33. **[Sprint 25 - Master Client/Project Flow Clarity](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_25_master_client_project_flow_clarity.md)**
    - _Status:_ Completed
    - _Isi:_ Memisahkan aksi `Client/Site Baru` dari aksi `Tambah Project ke Site Ini` agar flow Master vs project lebih jelas.
34. **[Sprint 26 - Hide Demo Seed Site From Master Dashboard](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_26_hide_demo_seed_site.md)**
    - _Status:_ Completed
    - _Isi:_ Menyembunyikan seed `default-site` / `demo-designer` dari Master Client Dashboard agar tidak terlihat seperti client nyata sebelum user membuat site baru.
35. **[Sprint 27 - Site Custom Quota Add-ons](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_27_site_custom_quota.md)**
    - _Status:_ Completed
    - _Isi:_ Menambahkan custom quota per site sebagai add-on Lite/Pro, effective quota backend, guard lowering quota, UI Master Dashboard, dan test Admin Sites.
36. **[Sprint 28 - Master Public URL Visibility](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_28_master_public_url_visibility.md)**
    - _Status:_ Completed
    - _Isi:_ Menampilkan Public URL, copy link, dan open link di Master Site agar URL site baru tidak perlu ditebak dari slug.
37. **[Sprint 29 - Tenant Dock Dedup](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_29_tenant_dock_dedup.md)**
    - _Status:_ Completed
    - _Isi:_ Memperbaiki Dock ganda pada route tenant seperti `/urgent` dengan menghindari render `GlobalDock` non-OS di tenant desktop.
38. **[Sprint 30 - Tenant Project Navigation](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_30_tenant_project_navigation.md)**
    - _Status:_ Completed
    - _Isi:_ Memperbaiki navigasi Projects agar site tenant seperti `/urgent` tetap menuju `/urgent/projects`, menambahkan katalog tenant, dan membuat link detail/back/filter/view mode tenant-aware.
39. **[Sprint 31 - Tenant Login Alias](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_31_tenant_login_alias.md)**
    - _Status:_ Completed
    - _Isi:_ Menambahkan alias login pembeli `/[siteSlug]/login` yang mengarah ke `/client/login?site=<slug>` dan auto-fill field Site slug.
40. **[Sprint 32 - Pro Testimonial Site Scope](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_32_pro_testimonial_site_scope.md)**
    - _Status:_ Completed
    - _Isi:_ Mengunci WhatsApp/testimoni sebagai fitur Pro-only, menambah endpoint/editor client site-scoped, menghapus fallback demo testimonial tenant, dan memblokir Dock/Spotlight/deep-link WhatsApp pada Lite.
41. **[Codex Security Scan - 2026-07-03](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/security_scan_2026_07_03.md)**
    - _Status:_ ✅ Remediated
    - _Isi:_ Menjalankan repository-wide Codex Security scan; menghasilkan 7 temuan reportable. Semua 7 temuan (1 High, 6 Medium) sudah di-remediate dan build verified.
42. **[Sprint 33 - FFmpeg Build Notice Cleanup](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_33_ffmpeg_build_notice_cleanup.md)**
    - _Status:_ Completed
    - _Isi:_ Membersihkan output `cf:build` dari catatan FFmpeg R2 yang selalu muncul saat env sudah benar; warning tetap muncul jika base URL kosong atau masih `/ffmpeg`.
43. **[Sprint 34 - Full Site Scope Content CRUD](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_34_full_site_scope_content_crud.md)**
    - _Status:_ Completed
    - _Isi:_ Membuat content/frontend CRUD, desktop OS content calls, helper legacy, homepage API, tenant labels, upload wallpaper, dan poster backfill menjadi site-aware dengan audit `site-scope:audit`.
44. **[Sprint 35 - Mass Sale Readiness](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_35_mass_sale_readiness.md)**
    - _Status:_ Production deploy, domain smoke, and manual acceptance RC1 completed
    - _Isi:_ Menambahkan client reset password self-service, sales/pricing docs, client operations docs, sale-readiness audit, Cloudflare build/deploy, smoke Worker/domain final, fix direct video upload production, cleanup reset rows, dan manual acceptance RC1.
45. **[Sprint 36 - 404 Lottie Not Found Page](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_36_404_lottie_not_found.md)**
    - _Status:_ Completed
    - _Isi:_ Mengganti halaman 404 agar memakai asset `public/lottie/404 Error.lottie` via renderer dotLottie, dan memverifikasi typecheck, lint, Cloudflare build, asset public, dan screenshot lokal.
46. **[Sprint 37 - Lottie Boot Screen](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_37_lottie_boot_screen.md)**
    - _Status:_ Completed
    - _Isi:_ Mengganti boot animation legacy keyhole/wordmark dengan Lottie `hello hitam.json`, auto-start, shortcut klik/keyboard, dan transisi slide-up ke desktop.
47. **[Sprint 38 - Icon Library Defaults](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_38_icon_library_defaults.md)**
    - _Status:_ Completed
    - _Isi:_ Menambahkan fallback icon bawaan public untuk Icon Library saat R2 kosong/belum configured, dan menyembunyikan delete untuk icon bundled.
48. **[Sprint 39 - CRUD UI/UX Standardization](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_39_crud_ui_ux_standardization.md)**
    - _Status:_ Completed
    - _Isi:_ Merapikan UX CRUD Master dan Client tanpa menyentuh shell OS, Dock, Window, atau efek jelly; menambah blocker reason, empty state, summary site, link login client, quota progress, dan preview readiness.
49. **[Sprint 40 - Client Dashboard Module Shell](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_40_client_dashboard_module_shell.md)**
    - _Status:_ Completed
    - _Isi:_ Menambahkan shell window dashboard client, 4 module cards sesuai Lite/Pro, badge status/tier, efek jelly ringan pada cards, dan anchor ke project/testimoni tanpa mengubah engine OS.
50. **[Sprint 41 - Client Tier Self-Service](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_41_client_tier_self_service.md)**
    - _Status:_ Completed
    - _Isi:_ Membuka self-service client sesuai tier: Lite/Pro untuk konten profil, kontak, pengalaman, hard skills, dan project/media; Pro untuk pengaturan sistem/tampilan aman dan testimoni.
51. **[Sprint 42 - Client Dashboard Window Launcher](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_42_client_dashboard_window_launcher.md)**
    - _Status:_ Completed
    - _Isi:_ Mengubah dashboard client menjadi launcher 4 modul seperti Master; setiap modul dibuka sebagai window/panel OS dengan traffic-light control dan efek jelly/pop.
52. **[Sprint 43 - Client Dashboard Desktop OS UI/UX](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_43_client_desktop_os_uiux.md)**
    - _Status:_ Completed
    - _Isi:_ Mengubah UI/UX Client Dashboard dari flat scrollable menjadi desktop OS environment penuh dengan jelly drag spring physics, floating windows, menubar, dan taskbar identik CRUD Master.
53. **[Sprint 44 - Backup Restore Drill](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_44_backup_restore_drill.md)**
    - _Status:_ Completed / Restore drill passed with D1 restore DB and local smoke
    - _Isi:_ Menambahkan script backup D1/R2, restore D1 staging-safe, audit integrity, runbook RPO/RTO, D1 restore database, dummy project/media drill, reattach orphan R2, backup ulang, restore apply, audit 0/0, dan local app smoke 10/10 terhadap D1 restore.
54. **[Sprint 45 - Production Monitoring Observability](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_45_monitoring_observability.md)**
    - _Status:_ 🟢 Completed / Full operational pass
    - _Isi:_ Fixed fence-post coverage calculation dan max HTTP failure rate threshold (0.5%) pada strict verifier; re-verified terhadap 288 reports loop 2026-07-16 dengan hasil FULL PASS (HTTP failure rate 0.1736%, storage failures 0, Resend API sent=true).
55. **[Sprint 46 - Multi Buyer Load Test](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_46_multi_buyer_load_test.md)**
    - _Status:_ 🟢 Completed / 5-tenant live test passed
    - _Isi:_ Menambahkan retry + exponential backoff dan request delay (1500ms) untuk Cloudflare Workers Free plan rate limiting; live run 5 tenant (lt20260717-fix5) PASS 100% (74 requests, 0 error, 0 isolation leaks, cleanup 100%).
    - _Audit 2026-07-18:_ 25-tenant live run juga pass (25/25, error rate 0.56%). 50-tenant stress bukan full pass (48/50, error rate 2.03%), walau 0 isolation leak dan cleanup dry-run terbaru matched 0.
56. **[Sprint 47 - Billing Automation](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_47_billing_automation.md)**

- _Status:_ 🟢 Completed (semi-otomatis: QRIS/Transfer + Telegram Bot 1-click activation)
- _Isi:_ Checkout Lite/Pro, alur instruksi bayar, Telegram Bot 1-click activation, Zero Slug Collision engine (dual-check availability), dan safe Client Slug Switcher feature. **Catatan:** Billing penuh (payment gateway integrasi, webhook otomatis, invoice generation) belum diimplementasikan. Yang ada adalah alur semi-otomatis dengan konfirmasi manual via Telegram Bot.

57. **[Sprint 48 - Verified Support Playbook](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_48_verified_support_playbook.md)**

- _Status:_ 🟢 Completed (4/5 dry-run pass, billing dry-run dilakukan manual 2026-07-21)
- _Isi:_ Playbook support terverifikasi untuk onboarding, login/reset, upload, quota, restore, suspend/activate, template jawaban, SLA, dan dry-run operator. Billing dry-run sudah dilakukan berdasarkan alur semi-otomatis Sprint 47 (Telegram Bot activation).
- _Audit 2026-07-18:_ Completed hanya untuk support non-billing yang diverifikasi teknis. Billing/refund dan dry-run operator non-developer masih pending.
- _Update 2026-07-21:_ Billing dry-run dilakukan berdasarkan scope semi-otomatis Sprint 47. Playbook billing dianggap cukup untuk operasi saat ini.

58. **[Audit Bug Tersembunyi - 2026-07-12](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/audit_hidden_bugs_2026_07_12.md)**

- _Status:_ ✅ Resolved (semua 3 bug diperbaiki di Sprint 34)
- _Isi:_ Menemukan cache invalidation project tenant yang tidak lengkap serta isolasi komentar dan metrik yang hanya berbasis slug. **Update 2026-07-21:** Semua 3 bug sudah diperbaiki oleh Sprint 34 (Full Site Scope Content CRUD): (1) `revalidateSiteProjectPaths()` handle path tenant, (2) `buildCommentPath(siteId, slug)` scope komentar per tenant, (3) `buildMetricsPath(siteId, slug)` scope metrik per tenant.

## 🚀 Program Baru: Multi-Template Marketplace (Sprint 49 – 59)

59. **[Sprint 49 - Multi-Template Contract Audit](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_49_multi_template_contract_audit.md)**

- _Status:_ 🟢 Completed
- _Isi:_ Audit ketergantungan OS desktop, pemetaan data mapper D1, spesifikasi tipe universal `PortfolioTemplateData`, dan dokumen arsitektur multi-template.

60. **[Sprint 50 - Database & Template Registry](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_50_database_template_registry.md)**

- _Status:_ 🟢 Completed
- _Isi:_ DDL D1 schema (`portfolio_templates`, `site_template_entitlements`, `site_template_settings`, `sites.active_template_key`), static registry, dan entitlement fallback resolver.

61. **[Sprint 51 - OS Adapter Without Engine Rewrite](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_51_os_adapter_no_engine_rewrite.md)**

- _Status:_ 🟢 Completed
- _Isi:_ Membungkus OS desktop menjadi `OSDesktopRenderer`, memasang `TemplateDispatcher` tanpa me-refactor file fragile OS (`Dock.tsx`, `Window.tsx`, `OSSystemContext.tsx`).

62. **[Sprint 52 - Landing Bento Template](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_52_landing_bento_template.md)**

- _Status:_ 🟢 Completed
- _Isi:_ Membangun template kedua Bento Grid (`landing-bento`) dari data `PortfolioTemplateData` yang sama persis tanpa kebocoran UI OS.

63. **[Sprint 53 - Client Template Picker](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_53_client_template_picker.md)**

- _Status:_ 🟢 Completed
- _Isi:_ UI catalog & sandboxed live preview iframe modal di Client Dashboard tanpa mutasi D1 publik sebelum konfirmasi, plus entitlement backend guard.

64. **[Sprint 54 - Master Admin Template CRUD](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_54_master_template_crud.md)**

- _Status:_ 🟢 Completed
- _Isi:_ Panel CRUD Master Admin untuk kelola katalog template, kategori, visibilitas Lite/Pro, harga, serta manual entitlement grant per site.

65. **[Sprint 55 - Public Template Catalog](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_55_public_template_catalog.md)**

- _Status:_ 🟢 Completed
- _Isi:_ Halaman pemasaran publik `/templates`, detail template, dan live demo `/templates/[templateSlug]/demo` terintegrasi dengan alur Checkout.

66. **[Sprint 56 - Billing & Template Entitlement](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_56_billing_template_entitlement.md)**

- _Status:_ Completed
- _Isi:_ Integrasi transaksi order & Telegram activation dengan auto-grant entitlement template ke `site_id` tenant.

67. **[Sprint 59 - Multi-Template Release & Acceptance](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_59_multi_template_release_acceptance.md)**

- _Status:_ 🟢 Completed
- _Isi:_ Pengujian regresi penuh, audit integritas multi-site D1, dan rilis resmi Multi-Template Marketplace.

## 🔒 Security Fix

68. **[Security Fix - Telegram Webhook Auth Bypass](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/security_fix_telegram_webhook_2026_07_21.md)**

- _Status:_ ✅ Remediated
- _Isi:_ Memperbaiki auth bypass pada `/api/telegram/webhook` yang memungkinkan aktivasi order tanpa bayar jika `TELEGRAM_BOT_SECRET` tidak di-set. Endpoint sekarang menolak semua request (403) jika secret tidak configured.

69. **[Code Cleanup, ESLint & Deadcode Fixes](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/code_cleanup_eslint_deadcode_2026_07_21.md)**

- _Status:_ 🟢 Completed
- _Isi:_ Memperbaiki error hoisting & react-hooks/set-state-in-effect di halaman admin & client modal, membersihkan deadcode & unused variables di marketplace pages, serta memverifikasi lint, tsc, audit, dan test (116 files, 806 test pass).

70. **[Sprint 60 - Homepage Marketplace & OS Live Demo Hardening](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_60_homepage_marketplace_live_demo.md)**

- _Status:_ Completed
- _Isi:_ Menjadikan katalog template sebagai homepage, mempertahankan homepage OS lama sebagai live demo, serta memperbaiki route Dock demo, boot marker, dan fallback ikon Bento.

71. **[Gemini Code & Dependency Removal](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/gemini_cleanup_2026_07_21.md)**

- _Status:_ 🟢 Completed
- _Isi:_ Menghapus dependensi `@google/generative-ai`, wrapper `src/lib/gemini.ts`, merefaktor `aiChatService.ts` ke REST API, mengganti `getGeminiApiKey` -> `getGoogleAiApiKey`, serta membersihkan branding "Gemini" pada UI, dictionary, dan unit tests.

72. **[Sprint 61 - Onboarding Wizard "3-Minute Launch"](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_61_onboarding_wizard.md)**

- _Status:_ 🟢 Completed
- _Isi:_ Stepping wizard 4-step di Client Dashboard untuk memandu pembeli baru mengisi profil, project pertama dengan Magic AI, memilih template, dan merilis site.

73. **[Sprint 62 - Live Preset Customizer di Public Demo](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_62_live_preset_customizer.md)**

- _Status:_ 🟢 Completed
- _Isi:_ Floating interactive control toolbar di halaman demo publik untuk mengubah warna aksen, font, dan wallpaper secara live tanpa mutasi DB.

74. **[Sprint 63 - Site-Scoped Analytics Lightweight Dashboard](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_63_site_scoped_analytics.md)**

- _Status:_ 🟢 Completed
- _Isi:_ Layanan analitik site-scoped internal, API beacon/fetcher, dan modul visual statistik di Client Dashboard.

75. **[Sprint 64 - Cloudflare Custom Domain Integration](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_64_custom_domain_integration.md)**

- _Status:_ 🟢 Completed
- _Isi:_ Integrasi domain kustom tenant Cloudflare SSL for SaaS, petunjuk CNAME, dan status verifikasi SSL di Client Dashboard.

76. **[Sprint 65 - Master Dashboard R2 Storage Usage UI](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_65_master_storage_usage_ui.md)**

- _Status:_ 🟢 Completed
- _Isi:_ Menampilkan indikator real-time pemakaian storage Cloudflare R2 per-site, total akumulasi R2 (seluruh site vs Cloudflare 10GB free tier), dan breakdown file media di Admin Master Dashboard.

77. **[Sprint 66 - Client Site Admin Auth Isolation](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_66_client_site_admin_auth_isolation.md)**

- _Status:_ 🟢 Completed
- _Isi:_ Isolasi sesi otentikasi ketat antara Master Admin (`admin_token`) dan Client Site Tenant (`client_token`). Mencegah login Master Admin memicu Mode Admin pada web client publik.

78. **[Audit Source Manual - 2026-07-27](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/manual_source_audit_2026_07_27.md)**

- _Status:_ 🟢 Resolved / Remediated
- _Isi:_ Audit source manual menemukan masalah order PII leak/unauth, activation lock race condition, slug reservation race, analytics fiktif, slug change limits, dan desired_slug skip. Semua 6 temuan terkonfirmasi telah di-remediate, diuji via unit tests (807 tests PASS), dan diverifikasi bersih dari lint/type errors.

79. **[External QRIS Dinamis Review - 2026-07-30](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/external_qris_dinamis_review_2026_07_30.md)**

- _Status:_ Completed
- _Isi:_ Review keamanan ringkas `verssache/qris-dinamis`; source app lokal tanpa exfiltration, prod audit bersih, dev dependency perlu update, dan nama paket npm publik ternyata milik repo lain.

80. **[External QRIS Static To Dynamic Review - 2026-07-30](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/external_qris_static_to_dynamic_review_2026_07_30.md)**

- _Status:_ Completed
- _Isi:_ Review keamanan ringkas `justpiple/qris-static-to-dynamic`; app script tanpa network API, tetapi CDN tanpa SRI, validasi QRIS tipis, dan cocok hanya sebagai alat bantu semi-otomatis dengan cek manual.

81. **[Sprint 67 - Dynamic QRIS Nominal Manual Verification](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_67_dynamic_qris_manual_verification.md)**

- _Status:_ Planned
- _Isi:_ Rencana upgrade billing semi-otomatis: QRIS merchant static dikelola Master, generator QRIS dinamis lokal tanpa CDN, nominal unik per order, dan aktivasi tetap manual setelah cek mutasi.

82. **[QRIS Static Upload & Dynamic QRIS Fix - 2026-07-31](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/qris_static_dynamic_fix_2026_07_31.md)**
    - _Status:_ 🟢 Completed
    - _Isi:_ Perbaikan image preview broken (R2 public base URL di `.env.local`), pengurutan numerik tag TLV QRIS dinamis (_ascending order_ per standar EMVCo/ASPI), dekode otomatis gambar `qris MIB.jpg` (_Make it better_), dan pengujian penuh (117 test files, 815 tests PASS).
83. **[Audit Payment Flow Logic Fix All - 2026-08-04](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/audit_payment_flow_logic_2026_08_03.md)**
    - _Status:_ 🟢 Completed (830 tests PASS, lint 0 error, tsc bersih)
    - _Isi:_ Menutup seluruh temuan audit alur pembayaran yang tersisa: owner renewal/upgrade flow (#1), guard downgrade Pro→Lite (#2), harga template transparan di UI + endpoint `/api/billing/template-price` (#4), index slug `activated` bebas dipakai ulang (#5), catch slug UNIQUE di upload bukti (#6), sweeper recovery `activating` macet (#7), re-upload tanpa spam Telegram (#8), dan harga plan satu sumber `src/constants/plans.ts` (#9).
84. **[Security Audit API & Auth Layer - 2026-08-11](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/security_audit_api_2026_08_11.md)**
    - _Status:_ ✅ Fully Remediated (2026-09-13 — #1 allowlist revalidate, #2 rate-limit login IP-only, #3 siteId binding direct-upload token + rate limit, #4 x-test-bypass removal)
    - _Isi:_ Audit read-only lapisan API/auth: middleware CSRF/auth, login rate limit, upload pipeline R2 (direct/presign), billing orders, dan revalidate. 1 bug fungsional HIGH + 3 hardening MEDIUM — semua sudah ditutup & terverifikasi (109 files / 825 tests PASS).
85. **[Bug Fix Sweep 2026-08-14](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/bug_fix_sweep_2026_08_14.md)**
    - _Status:_ 🟢 Completed
    - _Isi:_ Sweep perbaikan bug lintas modul: orphan project media cleanup (#18), Dock trash wiring (#24), project service fixes (#35–#38, #43, #44, #46), order service fixes (#39, #40, #45, #50), CSRF maxAge unify (#49), custom domain validation (#52), checkout plan price pills (#51), OrdersPanel realtime polling (#47), useAdminDesktop ID collision (#48), welcome note localStorage (#56), dan hapus x-test-bypass login (#57). Verifikasi: lint 0 error, tsc bersih, 838 tests PASS.

86. **[Template Removal - Editorial & 3D (2026-08-15)](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/template_removal_editorial_3d_2026_08_15.md)**

- _Status:_ 🟢 Completed
- _Isi:_ Menghapus total template `landing-editorial` (Sprint 57) dan `3d-spatial` (Sprint 58) dari kode, seed SQL, test, dan seluruh jejak dokumentasi (termasuk log Sprint 57/58, INDEX, architecture doc). Katalog tersisa 2 template: `os-desktop` & `landing-bento`. Verifikasi: tsc 0 error, lint 0 error, 836 tests PASS.

## 🚀 Program Bento Studio (Sprint 68 – 72) — COMPLETED 🟢

Kustomisasi per-section template `landing-bento` (Pro-only): kontrak settings zod + normalizer, service/API D1 `site_template_settings`, renderer config-driven + 2 variant/section + preset animasi, editor `/client/studio` (draft → Publish → revalidate), dan verifikasi build production + 873 tests.

87. **[Sprint 68 - Bento Studio Foundation](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_68_bento_studio_foundation.md)**

- _Status:_ 🟢 Completed
- _Isi:_ Fondasi program Bento Studio (kustomisasi per-section template `landing-bento`, Pro-only). Fix tier bento→pro di seed SQL, kontrak settings zod + `normalizeBentoSettings()` (5 section, 2 variant, 5 preset animasi), service D1 `site_template_settings` (upsert), API `GET/PUT /api/client/template-settings` (Pro guard + CSRF + revalidate + audit), dan wiring loader tenant/demo. Verifikasi: tsc 0 error, lint bersih, 118 files / 860 tests PASS.

88. **[Sprint 69 - BentoRenderer Config-Driven](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_69_bento_renderer_config_driven.md)**

- _Status:_ 🟢 Completed
- _Isi:_ Refactor `BentoRenderer` menjadi config-driven: urutan/visibilitas/variant section dari settings; 2 variant per section (hero default/compact, sequence full/minimal, projects grid/list, experience timeline/cards, contact split/centered); theme token diterapkan via CSS vars di root; registry `{type, variant}` → komponen. Verifikasi: tsc 0 error, lint bersih, 118 files / 863 tests PASS.

89. **[Sprint 70 - Bento Animation Presets](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_70_bento_animation_presets.md)**

- _Status:_ 🟢 Completed
- _Isi:_ Implementasi preset animasi `none`/`fade-up`/`slide-in`/`scale`/`stagger` lewat `AnimatedSection` (IntersectionObserver, hydration-safe, honor prefers-reduced-motion) + parallax ringan dari `motion.parallax`; registry membungkus setiap section dengan `section.animation`. Verifikasi: tsc 0 error, lint bersih, 119 files / 868 tests PASS.

90. **[Sprint 71 - Bento Studio Editor](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_71_bento_studio_editor.md)**

- _Status:_ 🟢 Completed
- _Isi:_ Editor fullscreen `/client/studio` (Pro-only, client auth): preview live config-driven, panel Theme/Motion/Sections (urutan, visibility, variant, animasi), Publish → `PUT /api/client/template-settings` (CSRF + normalize + D1 + revalidate); entry card "Bento Studio" di Client Dashboard. Verifikasi: tsc 0 error, lint bersih, 120 files / 873 tests PASS.

91. **[Sprint 72 - Bento Studio Program Verification](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_72_bento_studio_program_verification.md)**

- _Status:_ 🟢 Completed
- _Isi:_ Verifikasi produksi penutup program Bento Studio: build production PASS, 120 files / 873 tests PASS, tsc/lint bersih, wrap-up dokumentasi & INDEX. Backlog tercatat: adaptasi dark-mode contrast & `TemplateDemoCustomizer` dead code.

92. **[Sprint 73 - Bento Studio Serious Debugging & Fixes](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_73_bento_debugging_fixes.md)**

- _Status:_ 🟢 Completed
- _Isi:_ Mode debugging serius program Bento Studio. Terverifikasi BUKAN bug: pola insert `audit_logs`, signature `revalidateSiteContentPaths`, skema `site_template_settings`, kebijakan middleware untuk `/api/client/*`, dan self-healing `normalizeBentoSettings`. Dua bug nyata diperbaiki: (1) hydration mismatch `AnimatedSection` karena `prefersReducedMotion()` saat render (dipindah ke effect + state `reducedMotion`), (2) layout regression variant `full` `BentoImageSequence` (restore `lg:flex-row`). Verifikasi: 120 files / 873 tests PASS, tsc 0 error, lint bersih.

93. **[Sprint 74 - UI/UX Bento Tokens + Demo Cinematic](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_74_uiux_bento_tokens_cinematic_demo.md)**

- _Status:_ 🟢 Completed
- _Isi:_ Konsistensi UI template bento via token bersama `src/components/templates/landing-bento/ui.ts` (button/card/title/badge/tag + warna aksen `--bento-accent`, hapus hardcode emerald/teal; canvas 3D `BentoImageSequence` kini baca aksen via `getComputedStyle`). Rombak total demo `/templates/landing-bento/demo` → halaman cinematic scroll "Mostar city" (vanilla statis di `public/cinematic-mostar/`, demo page render iframe fullscreen; terisolasi dari Tailwind). Verifikasi: 120 files / 873 tests PASS, tsc 0 error, lint bersih, runtime engine animasi + slider 15 kartu aktif.

## 🏗️ Managed Service — Current Architecture (Sprint 75+)

> **PENTING:** Mulai Sprint 75, arsitektur berubah dari multi-tenant SaaS menjadi **Managed Service**. AI wajib merujuk bagian ini dan Sprint 75+ untuk pemahaman current.

94. **[Sprint 75 - Customer CRUD Foundation](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_75_customer_crud_foundation.md)**

- _Status:_ 🟢 Completed
- _Isi:_ Fondasi managed service lengkap: (1) Customer auth — email+password login via `/api/auth/*`, JWT jose Edge-compatible, SITE_ID hardcoded, cookie `site_user_token`; (2) API routes — hardcode SITE_ID di `siteRequestContext`, `projectSiteContext`, `siteMutationAuth`; (3) Admin UI — hapus owner zones (clientDashboard, paymentConfig, orders), sisa 3 zones: content/system/communications; (4) Schema — tambah tabel `app_kv` untuk konten legacy (about/experience/skills/contact/testimonials); (5) Setup — wizard `/setup` + API `/api/setup` + `seedDeployment()`; (6) Deploy — build/deploy scripts untuk Wrangler CLI. Verifikasi: tsc 0 error, eslint 0 warning, 104 files / 791 tests PASS, 43 files changed (+1002/-167).

95. **[Sprint 76 - Customer Auth, CSRF & Dev Runtime Fixes](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_76_customer_auth_and_runtime_bugfixes.md)**

- _Status:_ 🟢 Completed
- _Isi:_ Perbaikan bug fatal & cacat logika: (1) Mismatched HMAC key derivation di `customer-auth.ts` disinkronkan dengan `session.ts`; (2) `GET /api/auth/check-auth` selalu menyediakan CSRF token dan cookie agar form login tidak terkunci; (3) Allowlist CSRF middleware ditambahkan `/api/setup`, `/api/auth/login`, `/api/auth/logout`; (4) `validateAdminRequest` di `@/lib/auth` mendukung sesi customer `site_user_token`; (5) `scripts/core/dev.js` probe IPv4/IPv6 dual-stack & event `close`; (6) Cleanup unused variables. Verifikasi: tsc 0 error, eslint 0 error, 107 files / 803 tests PASS.

96. **[Sprint 77 - Consumer Dashboard AI Settings](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_77_consumer_dashboard_ai_settings.md)**

- _Status:_ 🟢 Completed
- _Isi:_ Fitur Pengaturan Asisten AI di dashboard admin konsumen: (1) Universal AI Gateway `aiGatewayService` mendukung Google Gemini, OpenRouter, Groq, OpenAI, dan pihak ketiga (9router/Custom Base URL OpenAI-compatible); (2) API routes `/api/admin/ai/settings` dan `/api/admin/ai/test` dengan live ping test & masking; (3) UI dashboard `/admin/system/ai` dengan selector provider, input Base URL cepat, toggle intip kunci, dan tombol tes koneksi; (4) Registrasi app Asisten AI di zona system desktop admin & pintasan di Template Hub; (5) Update dokumentasi panduan owner & klien. Verifikasi: tsc 0 error, eslint 0 error, 109 files / 818 tests PASS.

97. **[Sprint 78 - Auth Redirect, CRUD Unification & 1-Click Zero-Terminal Onboarding](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_78_auth_redirect_and_crud_unification.md)**

- _Status:_ 🟢 Completed
- _Isi:_ Penataan autentikasi, penyatuan CRUD, integrasi tema penuh, dan automasi onboarding: (1) Hapus stealth 404 rewrite di middleware untuk `/admin`, ubah menjadi HTTP 307 redirect bersih ke `/admin/login?redirect=...`; (2) Eradikasi total tombol "Template Hub" di MenuBar dan penghapusan direktori redundant `/admin/templates/` (redirect permanent ke `/admin`); (3) Penyatuan 100% data CRUD ke template `infinite-canvas` (Opsi 1: Profile, Projects + Modal detail with image error fallback, Skills, Experience, Contact, dan Quick Jump HUD Navigator); (4) Asisten Onboarding & Custom Domain Manager 1-Klik (`BUAT_KLIEN_BARU.bat` + `scripts/onboarding/server.ts` + UI web modern minimalis) untuk Master non-koder dengan jaminan isolasi 100% database Cloudflare D1 & media R2, pengelolaan domain otomatis via Cloudflare Pages API, serta pengarsipan aman di `arsip-klien/`; (5) Pembaruan menyeluruh `panduan/PANDUAN_UNTUK_KAMU_OWNER.md` dan `panduan/PANDUAN_UNTUK_KLIEN.md`. Verifikasi: tsc 0 error, eslint 0 error, 109 files / 818 tests PASS.

98. **[Sprint 79 - Demo Projects & Universal Media Assets Migration](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_79_demo_projects_and_assets_migration.md)**
    - _Status:_ 🟢 Completed
    - _Isi:_ Migrasi 21 proyek portofolio dan 43 aset media (video `.mp4`, cover `.jpg`, perbandingan `.webp`) dari repositori lama `portfolio-shared-vercel` ke Cloudflare D1 dan Cloudflare R2 `portfolio-template`. Seluruh file diberi prefix `demo-` (pada direktori `assets/demo/projects/` dan `assets/demo/media/`), disinkronkan ke tabel D1 SQL (`projects`, `project_narratives`, `media_assets`) serta `app_kv` untuk `default-site`, dan disimpan salinannya di `public/assets/demo/` sebagai offline fallback. Verifikasi: query SQL 22 projects, 43 R2 objects terverifikasi 100%.

99. **[Sprint 80 - macOS Desktop Refinement: Narrative Subtabs, Gallery Cleanup, Dock Streamlining, 3D Canvas Optimization & Grid/3D Popup Modal](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_80_macos_desktop_refinement.md)**
    - _Status:_ 🟢 Completed
    - _Isi:_ Penyempurnaan UX template macOS Desktop (`/preview/os-desktop`) & Optimasi Performa 3D Canvas (`/projects?view=3d`): (1) Perbaikan pemetaan narasi di `projectMapper.ts` dan sinkronisasi 21 proyek agar tab Ringkasan (`description`) dan tab Proses (dengan sub-tab browser curve: Konsep, Proses, Detail) tampil lengkap dan identik; (2) Eradikasi tab "Galeri (1)" palsu dengan mengosongkan gambar cover ganda di `media_assets` dan array galeri metadata di seluruh proyek; (3) Penghapusan total ikon & logika Mission Control dan Trash dari navigasi Dock bawah (`Dock.tsx`, `UIOverlaysLayer.tsx`, `DockConfigForm.tsx`), menyisakan 5 aplikasi esensial (Projects, About Me, WhatsApp, Contact, Notes); (4) Perbaikan 404 pada URL `/preview/projects` via tenant routing allowlist & redirect; (5) Optimasi performa drastis 3D Infinite Canvas (Opsi B): video play-on-hover only (hemat decoder ~80%), eliminasi beban kalkulasi per-frame CSS blur shader, penurunan radius sel (27 sel) & batas kartu aktif (40 kartu) sehingga 60 FPS stabil di semua perangkat; (6) Perbaikan navigasi balik `GlobalDock`: item About Me, WhatsApp, Contact, dan Notes kini mengarah balik ke `/preview/os-desktop?app=...` dan otomatis membuka jendela terkait di atas desktop macOS; (7) Pembukaan tombol Live Preview di Landing Page (`LandingPage.tsx`) pada tab browser baru (`target="_blank"`); (8) Penghapusan tombol link 'Pesan OS' dan icon ShoppingCart dari MenuBar desktop macOS (`MenuBar.tsx`); (9) Integrasi popup jendela macOS (`OSWindow` via `ProjectDetailWrapper` & `useWindowContext`) saat kartu diklik pada mode Grid (`/projects?view=grid`) maupun 3D View (`/projects?view=3d`) persis sesuai jendela di `os-desktop`, tanpa navigasi keluar ke halaman slug (rute `/projects/[slug]` tetap dipertahankan aman sebagai fallback); (10) Penghapusan floating tooltips kursor pada 3D View (`InfiniteCanvasView.tsx`) dan pembersihan overhead komputasi bounding box pada event pointer move; (11) Memperbaiki viewport anchoring pada `WindowRenderer.tsx` menggunakan container `fixed inset-0 pointer-events-none z-[500]` sehingga popup window macOS tetap terkunci diam di viewport (_fixed on screen_) dan tidak ikut tergulung ke atas saat pengunjung melakukan scroll pada halaman grid; (12) Master Portal Pengelola Klien & 1-Klik Client Template Update System: Konsolidasi onboarding, domain management, dan update template klien menjadi satu launcher terpadu `PENGELOLA_KLIEN.bat` (dengan alias `BUAT_KLIEN_BARU.bat`). Menambahkan Tab 3 ('Update Versi Template') pada UI asisten lokal (`scripts/onboarding/server.ts` & `index.html`) dengan kemampuan kompilasi OpenNext (`npm run cf:build`) dan live SSE streaming deploy ke Cloudflare Pages untuk single client maupun batch update seluruh klien di `arsip-klien/` tanpa risiko merusak database D1 atau storage R2 milik klien. Verifikasi: 109 test files / 821 tests PASS, ESLint 0 error, build status ready, dan browser verification live verified.

100.  **[Sprint 81 - Cloudflare Production Deployment](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_81_production_deploy_to_cloudflare.md)**
      - _Status:_ 🟢 Completed
      - _Isi:_ Deployment penuh proyek `portfolio-template` ke akun Cloudflare owner (`m4keitbetter@gmail.com`). Pre-deploy gates lolos, kompilasi build OpenNext `.open-next/worker.js` (gzip 3031.14 KiB) berhasil, upload aset statis dan binding R2 berhasil, worker trigger `portfolio-os-template` aktif (Version ID: `64c35d11-1a8e-4596-b87a-3e8d8841cf08`). Seluruh rute produksi (`/`, `/api/health`, `/admin/login`, `/preview/os-desktop`, `/preview/infinite-canvas`, `/api/projects`, `/setup`, dan custom domain `https://makeitbetter.my.id`) terverifikasi 200 OK.

101.  **[Sprint 82 - macOS Desktop Performance & Click Responsiveness Optimization](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_82_macos_performance_click_responsiveness.md)**
      - _Status:_ 🟢 Completed
      - _Isi:_ Mengatasi 2 isu performa pada template macOS desktop: (1) Menghilangkan kelambatan perpindahan antar halaman dengan mempercepat durasi view-transition dari 800ms menjadi 350ms/320ms ber-kurva fluid iOS/macOS, memangkas delay buatan dock bounce dari 280ms ke 90ms, dan memangkas timer transitionPhase; (2) Memperbaiki responsivitas klik aset gambar/video menjadi instan 1-klik dengan mengaktifkan single-click project window opener pada desktop icon, memasang threshold drag (> 5px) agar getaran mikroskopis mouse tidak membatalkan event klik, mengaktifkan single-click preview pada jendela Explorer/Finder, serta menerapkan pointer-events-none pada video tanpa kontrol agar klik diteruskan dengan mulus ke container. Verifikasi: 109 test files / 821 tests PASS, TypeScript compiler 0 error.

102.  **[Sprint 83 - 4K Live Video Wallpaper & Dynamic Island Clean-up (v1.2.2)](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_83_live_video_wallpaper_and_dynamic_island_removal.md)**
      - _Status:_ 🟢 Completed
      - _Isi:_ Mengaktifkan live video wallpaper 4K di Cloudflare R2/D1 (`Hunt Showdown Veil of Thorns`, `Zen Kois`, `Pink Bloom`, dan `Sachiro Dark Nights`) dengan pemutaran otomatis (`autoplay`, `preload="auto"`, `loop`, `muted`) serta fail-safe fallback otomatis agar layar tidak pernah blank/hitam. Menghapus komponen Dynamic Island dan floating bubble notifikasi di bagian atas desktop macOS agar tampilan lebih bersih, minimalis, dan berfokus penuh pada konten. Versi template dinaikkan ke v1.2.2 di `CHANGELOG.md` dan terintegrasi otomatis ke portal `PENGELOLA_KLIEN.bat`. Verifikasi: 109 test files / 821 tests PASS, live deployment version `f473ee2f-1b1c-44f0-9e7e-08761492118d`.

103.  **[Sprint 84 - Codebase Clean-up & Architecture Streamlining (v1.2.3)](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_84_codebase_cleanup_and_dead_code_removal.md)**
      - _Status:_ 🟢 Completed
      - _Isi:_ Pembersihan menyeluruh dead code dan berkas tanpa fungsi (penghapusan 11 file mati termasuk `DynamicIsland.tsx`, `HomeOSBootstrap.tsx`, `ReadMoreDescription.tsx`, `ProjectMediaUpload.tsx`, `AdminSidebar.tsx`, `useAdminAbout.ts`, `middleware/auth.ts`, serta 3D assets sisa), penataan berkas berantakan di root & scripts ke subfolder spesifik (`docs/agent-context/`, `docs/reports/`, `backups/`, `scripts/test/`, `scripts/maintenance/`), dan perbaikan error React Compiler / ESLint `react-hooks/set-state-in-effect` pada background wallpaper serta eliminasi unused variables. Verifikasi: 109 test files / 821 tests PASS (100%), tsc 0 error, eslint 0 error 0 warning, pre-deploy pass.

104.  **[Sprint 85 - macOS Desktop Performance Optimization & Low-End Device Hardening (v1.2.4)](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_85_macos_desktop_performance_low_end_devices.md)**
      - _Status:_ 🟢 Completed
      - _Isi:_ Optimasi performa demo template macOS Desktop (`/preview/os-desktop` dan `/`) mencapai skor 100% sempurna: (1) Fail-safe fallback wallpaper ke poster WebP tajam saat mode hemat daya/autoplay ditolak; (2) Hardware tier guard CPU <= 2 core agar perangkat berspesifikasi rendah (_device kentang_) otomatis menyajikan poster statis 16KB dan membebaskan CPU/GPU untuk animasi drag/dock 60 FPS; (3) Passive resize listeners & deduplikasi re-render; (4) Kompresi 100% gambar statis di `public/` (0 gambar > 200KB) dan eliminasi 5 duplikat PNG 7MB; (5) Tree-shaking package `@dnd-kit` & `fuse.js`. Verifikasi: 109 test files / 821 tests PASS, tsc 0 error, eslint bersih, audit performa 6/6 (100% PASS).

105.  **[Sprint 86 - macOS Desktop Lighthouse 100 Audit, Web Vitals & Production Hardening (v1.2.5 & v1.2.6)](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_86_macos_desktop_lighthouse_100_audit.md)**
      - _Status:_ 🟢 Completed
      - _Isi:_ Audit dan optimasi komprehensif skor Lighthouse macOS Desktop (`/preview/os-desktop`): (1) Accessibility 100/100 (WCAG 2.5.3 label in name compliance & WCAG 2.5.8 touch target spacing); (2) Best Practices 100/100 (CSP whitelist Cloudflare Analytics, D1 sound config sanitasi & auto-localization ke `/sounds/` eliminasi 404, on-demand video streaming `preload="metadata"` eliminasi QUIC protocol error); (3) Performance 91-95/100 (instant boot bypass crawler 0ms via `navigator.webdriver`, akselerasi boot screen manusia, lazy loading thumbnail ikon desktop, TBT 0ms sempurna, CLS 0.00-0.01 sempurna); (4) SEO 100/100 local / 92/100 live (pembersihan legacy robots.txt Vercel, route handler `src/app/robots.txt/route.ts` ber-header `no-transform`, canonical URL & sitemap registration). Verifikasi: 109 test files / 821 tests PASS (100%), tsc 0 error, eslint 0 error, deployed worker version `71c0fc67-6f99-45bd-a82f-bdbd27b52363`.

106.  **[Sprint 87 - Cloud Master Mobile Onboarding & GitHub Actions Automation (v1.2.7)](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_87_cloud_master_mobile_onboarding.md)**
      - _Status:_ 🟢 Completed
      - _Isi:_ Mengaktifkan kapabilitas pengelolaan klien penuh langsung dari HP tanpa perlu menyalakan PC: (1) Workflow manual GitHub Actions `.github/workflows/pengelola-klien.yml` dengan formulir input ramah HP; (2) Engine CLI mandiri `scripts/onboarding/cloud-manager.ts` menyatukan provisioning Cloudflare D1 & R2 terisolasi, migrasi skema tabel, seed akun, kompilasi OpenNext, deploy ke Cloudflare Pages, serta rendering Job Summary dan pesan WhatsApp siap salin; (3) Pengarsipan berkas kredensial aman via GitHub Artifacts terenkripsi 90 hari; (4) Panduan praktis 3-langkah di `panduan/PANDUAN_KELOLA_DARI_HP.md`. Verifikasi: 109 test files / 821 tests PASS (100%), tsc 0 error, eslint bersih.

107.  **[Audit Logic Defects & Security Sweep - 2026-09-11 (v1.2.8)](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/audit_logic_defects_2026_09_11.md)**
      - _Status:_ 🟢 Completed
      - _Isi:_ Audit manual lapisan auth/rate-limit/setup menemukan 8 cacat logika terverifikasi, semuanya diperbaiki: (1) Rate limit login customer `/api/auth/login` (HIGH — sebelumnya bisa brute force tanpa batas); (2) prune entry kadaluarsa di row D1 `rateLimits` + fail-closed saat transaction CAS gagal commit (HIGH); (3) fallback lokal menghormati blokir aktif setelah window habis (MED); (4) race setup 2 admin ditutup via atomic `INSERT ... WHERE NOT EXISTS` (MED); (5) `validateAdminRequest` kini cek `session.siteId === SITE_ID` — menutup token lintas deployment (MED); (6) refresh token tanpa claim role tidak lagi di-default jadi admin (LOW); (7)-(8) dead code berbahaya dihapus (`crud/shared/security/rateLimit.ts`, `validateRequestWithCSRF`). Verifikasi: tsc 0 error, eslint bersih, 109 files / 821 tests PASS.

108.  **[Phase 1 Safe Refactor — Zero-Risk Quick Wins (v1.2.9)](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/refactor_phase1_safe_quick_wins.md)**
      - _Status:_ 🟢 Completed
      - _Isi:_ Fase pertama refactor file terlarang (konsensus GLM 5.3 + Gemini 3.8, 0 behavior change): (1) dedup `getViewport()` 4 file → `os/utils/viewport.ts`; (2) `DesignPhilosophyForm` 765→497 baris (constants → `src/constants/designPhilosophy.ts`, tipe dedup ke kanonik `@/types/about`); (3) `ExitIntentFeedback` 504→339 baris (`FeedbackEyeIcon` Lottie + session helpers → file terpisah); (4) `upload/route.ts` 791→585 baris (helpers murni → `src/lib/media/uploadHelpers.ts`, static imports only, error mapping verbatim). Guard dipatuhi: barrel `positionSync` utuh (3 dynamic import aman), stub legacy tetap diekspor, 8 protected cores tidak tersentuh. Verifikasi: tsc 0 error, eslint bersih, 109 files / 821 tests PASS.

109.  **[Phase 2 Safe Refactor — Decoupling Komponen Besar (v1.3.0)](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/refactor_phase2_decoupling.md)**
      - _Status:_ 🟢 Completed + QA Visual Verified (2026-09-13: magnifikasi dock 72→110px, popover, window open, Notes toggle — semua PASS)
      - _Isi:_ Fase kedua refactor terencana (0 behavior change): (1) `Dock.tsx` 1064→~420 baris — ekstrak `DockItem` (hover physics/bounce/popover, props-driven), `GlobalDock`, `OSDock` ke file sendiri; core Dock (magnifikasi `mouseX`, popover terpusat, dnd-kit + admin persist) tetap satu unit; barrel re-export menjaga 2 import path lama; (2) `AdminExplorerClient.tsx` 890→598 baris — antrean upload & kompresi FFmpeg pindah ke hook `useExplorerUploadQueue` yang memegang sendiri `compressChainRef` + `currentParentIdRef` (serialisasi WASM tetap satu closure). Verifikasi: tsc 0 error, eslint 0 error/0 warning, 109 files / 821 tests PASS. QA visual dock selesai 2026-09-13 (drag reorder admin opsional).

110.  **[Sprint 88 - Customer Password Management + Owner Client Status Board (v1.3.2)](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_88_password_and_status_board.md)**
      - _Status:_ 🟢 Completed
      - _Isi:_ Menutup backlog managed service: (1) Self-service change password — service `changeSiteUserPassword` + `POST /api/auth/change-password` (CSRF + auth + rate limit) + rewire `ChangePasswordModal` dari endpoint legacy K/V ke `site_users` (bug ditemukan: menu Keamanan selama ini menulis ke K/V legacy sehingga password login tidak berubah); (2) Owner-assisted reset — CLI `reset-customer-password.ts` via Cloudflare D1 API dari arsip-klien + pesan WhatsApp siap salin; (3) Client Status Board owner-side — `GET /api/status` portal onboarding (health-check paralel, versi vs CHANGELOG) + tab "Status Klien" (online/offline, latency, badge versi, domain, link admin). Verifikasi: tsc 0 error, eslint bersih, 111 files / 838 tests PASS, QA visual portal.

111.  **[Sprint 89 - Infinite Canvas Layout Redesign & Interactive Dock (v1.3.3)](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_89_infinite_canvas_layout_dock.md)**
      - _Status:_ 🟢 Completed
      - _Isi:_ Perombakan layout template Infinite Canvas & Navigasi Dock: (1) Membatasi render menjadi 10 aset karya dari 21 proyek demo, disebar merata di 4 kuadran (Atas, Bawah, Kanan, Kiri) mengitari pusat koordinat (0, 0) dengan rotasi artistik dan zero collision; (2) Mengganti modal popup tengah dengan Right Slide-Over Drawer bergaya jendela macOS (header traffic lights + judul + dua kolom pratinjau media dan tab narasi/galeri/ulasan); (3) Membersihkan permukaan kanvas dari widget statis (profil, skills, experience, kontak); (4) Menghadirkan Left Slide-Over Drawer on-demand untuk konten yang dibuka via Dock; (5) Floating Dock modern bergaya macOS dengan 5 ikon: About Me, WA, Project, Hubungi Saya, dan Noted. Verifikasi: tsc 0 error, eslint 0 error/0 warning, 112 test files / 845 tests PASS (+7 tests baru).

112.  **[Sprint 90 - Spatial Gallery Total Rework: Particle Sphere 3D Orbit (v1.3.4)](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_90_spatial_gallery_particle_sphere.md)**
      - _Status:_ 🟢 Completed
      - _Isi:_ Rombak total engine template Spatial Gallery (basis komponen 21st.dev yang diadaptasi): (1) `RingGallery.tsx` baru — 1500 partikel fibonacci via InstancedMesh (1 draw call) + hingga 24 gambar project mengorbit ekuator bola radius 9 menghadap keluar, auto-rotasi + OrbitControls (drag/zoom/pan); (2) TextureLoader dengan rantai fallback poster video → cover → gallery[0], tanpa Suspense (aman 404); (3) PRNG mulberry32 deterministik menggantikan Math.random (tuntutan react-hooks/purity React Compiler); (4) Renderer rewrite: Canvas + OrbitControls (memperbaiki fatal error "R3F: Hooks can only be used within the Canvas"); (5) Hapus 16 file dead code lama (Scene, ArtworkOrbit, OrbitalSystem, CameraRig, CurvedGrid, dll) — folder spatial-gallery kini 2 file; (6) Bugfix parasit: import mati `OSDock` di UIOverlaysLayer (sisa refactor Phase 2) → path benar `../core/OSDock`. Verifikasi: tsc 0 error (file terkait), eslint bersih, QA browser runtime PASS console bersih.

113.  **[Sprint 91 - Spatial Gallery Bugfix: Aset DB Tampil Hitam (v1.3.5)](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_91_spatial_gallery_texture_black_fix.md)**
      - _Status:_ 🟢 Completed
      - _Isi:_ Perbaikan bug kritis di template Spatial Gallery: semua tile gambar hasil render D1/R2 tampil HITAM (helm 3D + grid shader normal). Root cause: manual `TextureLoader.load()` + `useState` yang dipakai saat porting dari `helmetsrc` gagal upload texture ke GPU dengan color space benar. Fix: ganti manual loader dengan `useTexture` dari `@react-three/drei` (suspense-based, sama persis pola source asli). Fallback lokal `/tube/` (aset bawaan helmetsrc) berfungsi normal. Verifikasi: 12+ tekstur R2 ter-fetch 200, console bersih.

114.  **[Hardening Keamanan & Stabilitas — Audit Eksternal (v1.3.6)](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/security_stability_hardening_2026_09_25.md)**
      - _Status:_ 🟢 Completed
      - _Isi:_ Audit eksternal terverifikasi + remediasi penuh: (1) Upgrade Next 16.2.12→16.3.6 menutup CRITICAL Unauthenticated RCE (GHSA-p293-qw3h-jr36 + AVIF image-opt); (2) sweep dependency (postcss 8.5.28 override+dedup nested, sharp 0.35.4, vitest 4.1.11, audit fix undici/ws/js-yaml) → `npm audit` 0 temuan; (3) bug senyap redirect mati: dua `async redirects()` duplikat di next.config.mjs — definisi kedua menimpa yang pertama sehingga /works, /project, /home, /index tidak pernah aktif; dihapus & terverifikasi 308 di production start; (4) CSP worker-src blob (FFmpeg) + konsolidasi security header ke middleware addSecurityHeaders; (5) pemisahan secret JWT_SECRET vs REVALIDATION_TOKEN di r2Storage signing; (6) fix type never DockProjectModes (LucideIcon), test basi grid-dropdown InfiniteCanvasRenderer, install @testing-library/dom (20 file test gagal), exclude .kilo worktree dari vitest, hapus lint warning SpatialModelManager. Verifikasi: tsc 0 error, lint 0/0, 112 files / 851 tests PASS, next build PASS, smoke header + redirect 308. **Follow-up: deploy produksi (cf:deploy) belum dijalankan untuk 1.3.6.**

115.  **[Optimasi Lighthouse 3 Template Preview — Misteri LCP os-desktop Terpecahkan (v1.3.7)](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/perf_preview_templates_2026_09_25.md)**
      - _Status:_ 🟢 Completed (lokal; deploy menunggu perintah owner)
      - _Isi:_ Lanjutan sesi opencode (Fase 0–3 tuntas sebelumnya: preview SSG, r2Storage guard, spatial poster SSR P91–93, canvas poster-first video P78–80). Kontribusi sesi ini: (1) **Misteri LCP os-desktop terpecahkan** — repro statis terisolasi membuktikan Blink MENGECAULIKAN elemen yang paint-nya ≥100% area viewport dari kandidat LCP (tinggi 843px teregistrasi @60ms/328.770px², 844px = viewport persis TIDAK pernah; oklusi/remount/translateZ/blur semua digugurkan via ablation probe). Fix: `h-[calc(100%-1px)]` stage wallpaper + filter guard blur(0px) + videoIdleReady gate → LCP-ELEMENT kini img wallpaper (fase bersih TTFB 15ms + render 0.8s), P65–68 (tahanan kini bootup chunk, bukan LCP); (2) A11y DockItem aria-haspopup/expanded hanya saat ber-role → A89→96 (target-size tertunda: kasusnya spacing ikon dari layout admin, bukan ukuran klik); (3) fix infrastruktur: polyfill localStorage untuk jsdom 28 di src/tests/setup.ts → 42 test mati pulih, 112 files/851 tests PASS. Verifikasi: tsc 0, lint 0, build ✓ 67/67 static, Lighthouse 3-run repeatability terdokumentasi. **Scratch probe lcp-\*.cjs + public/lcp-test.html wajib dihapus sebelum commit.**

116.  **[Penyelarasan UI/UX Dock macOS Desktop Mobile & Desktop (v1.3.8)](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/dock_mobile_responsiveness_alignment_2026_09_28.md)**
      - _Status:_ 🟢 Completed
      - _Isi:_ Penyelarasan Dock dengan referensi `portfolio ramos`: ikon mobile fix 48px (desktop 52px), kapsul kaca mobile 68px radius 24px, perataan `items-center justify-center gap-2`, magnifikasi hover nonaktif di mobile + squish bounce saat tap, listener resize viewport di `OSDock`, safe-area inset `GlobalDockSlot`, dan hardening popover outside-click 50ms. Plus perbaikan **regresi dock hilang total di `/preview/os-desktop`**: `DockPortal` sempat diubah jadi `if (!target) return null` padahal `GlobalDockSlot` hanya terpasang di layout `(site)`/`[siteSlug]` (route `/preview/*` pakai root layout tanpa `LayoutClient`) → fallback dikembalikan **tanpa `id` dan tanpa `viewTransitionName`** (mencegah duplikat 1-frame yang membuat Chrome membuang snapshot view-transition) dengan kelas disatukan ke `DOCK_SLOT_CLASS`. Verifikasi: `/preview/os-desktop` dock 1 / slot 0 / VT-named 0, `/projects` slot 1 / dock 1 / VT 1, rect identik, console bersih.

117.  **[Perbaikan Poster Wallpaper Video — Semua Poster Isinya Sama (Foto Orang) (v1.3.8)](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/wallpaper_poster_fix_2026_09_28.md)**
      - _Status:_ 🟢 Completed
      - _Isi:_ Diagnosa laporan "wallpaper JPG muncul padahal wallpapernya video, gambarnya orang di tengah". Dua hal: (a) tampil JPG dulu = desain _poster-first_ untuk LCP (by design); (b) **isi poster salah** — keempat poster side-car identik byte-per-byte (`5E845822…`, 37.402 byte, foto orang) karena `upload-video-wallpapers-r2-d1.ts` membuat SATU `posterBuffer` dari `public/wallpapers/optimized-wallpaper.png` lalu meng-upload buffer sama ke 4 key. Perbaikan: capture frame asli 0,5 detik tiap video via canvas browser → upload ke key yang sama (4 MD5 kini berbeda), tambah `?v=2` pada `posterUrl` 4 entry D1 (`content_default-site` + `content`) untuk mem-bust cache `immutable, max-age=31536000`, hapus upload poster bersama dari script Sprint 83, dan `extractStoragePath()` kini membuang query/fragment agar key `?v=2` tidak dianggap dangling oleh audit/cleanup. Verifikasi: tsc 0, eslint 0, **113 files / 856 tests PASS**, poster ter-render = frame video yang benar. Follow-up tercatat: `optimized-wallpaper.png/.webp` (foto orang) masih jadi `DEFAULT_WALLPAPER_URL` + 2 entry koleksi D1 bernama "macOS Monterey …". **Follow-up ini dituntaskan di entri 118.**

118.  **[Wallpapers Statis: Foto Orang Diganti Frame "Veil of Thorns" — lokal, R2, D1 (v1.3.8)](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/wallpaper_poster_fix_2026_09_28.md)**
      - _Status:_ 🟢 Completed
      - _Isi:_ Tindak lanjut entri 117. (a) 3 file lokal yang masih direferensikan (`optimized-wallpaper.webp/png` + fallback `1772328103874-…wallaper.webp`) ditulis ulang isinya = frame video Hunt "Veil of Thorns" 1920×1080 (webp q60 192.372 B; png palet 1152×648 181.725 B; semua <200KB), sehingga tak ada lagi foto orang di `DEFAULT_WALLPAPER_URL`; (b) 10 file foto `.avif`/`.webp` tak terpakai **dihapus** (folder kini 3 file); (c) script one-time `scripts/cloudflare/fix-wallpaper-statics.ts` (dry-run default, `--apply`): upload ulang 2 key R2 `optimized-wallpaper.*` isi frame baru, hapus 2 objek R2 orphan (kini 404), dan rename 2 entry D1 "macOS Monterey Gradient/High-Res" → "Veil of Thorns (Statis)"/"(Statis, PNG)" + `url` `?v=2` di `content_default-site` & `content` (`activeWallpaperId` tetap video); (d) landmine rerun dibersihkan: `fix-wallpapers-d1-r2.ts` (upload entry file terhapus dibuang, `defaultWallpapers` nama baru + `?v=2`, dan **guard: `activeWallpaperId`/`blur` tidak lagi di-reset saat rerun** — perubahan perilaku, dilaporkan ke owner) + `upload-video-wallpapers-r2-d1.ts` (2 entry statis hardcoded ikut nama baru + `?v=2`). Verifikasi: D1 dump nama baru + `?v=2`, GET `?v=2` MD5 `1CFFD9DC9243…` = file lokal (lama `A97C89FC…`/`B6E94B19…`), orphan 404, `/preview/os-desktop` tampil frame video tanpa foto orang + console 0 error, tsc 0, eslint 0, **113 files / 856 tests PASS**. Catatan: `optimize-assets.js` bila dijalankan ulang akan menimpa webp q60 baru dengan turunan q80 1152×648.

119.  **[Deploy Produksi: Bug Foto Orang di Demo `makeitbetter.my.id` Ditunggalkan + Insiden workerd `CreateDirectory` (v1.3.8)](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/wallpaper_poster_fix_2026_09_28.md)**
      - _Status:_ 🟢 Completed (owner menyetujui deploy)
      - _Isi:_ Laporan owner "di demo template pun ada bug visual yg sama wallpaper orang itu muncul pas awal mulai". Diagnosis 3 lapis: D1 & R2 produksi **sudah benar** (API live kembalikan "Veil of Thorns (Statis)" + `?v=2`), tapi (1) **HTML ISR basi** (`x-opennext-cache: STALE`, poster tanpa `?v=2`, nama "macOS Monterey …" — cache-bust query tidak membantu, masalah di KV incremental origin) sehingga browser pengunjung lama menyajikan poster foto orang dari cache `immutable` 1 tahun di frame pertama; dan (2) **aset `public/wallpapers/` di produksi masih foto orang** (`optimized-wallpaper.webp` 16.146 B `A97C89FC7660…` = `DEFAULT_WALLPAPER_URL`). Keduanya hanya bisa dibenahi dengan **deploy ulang**. Deploy #1 **gagal**: `opennextjs-cloudflare deploy` → `getPlatformProxy` → workerd `kj/filesystem-disk-win32.c++:773 CreateDirectory: #5 Access is denied` (uniqueKey DO `miniflare-email-store`). Disingkirkan: bukan AV (hanya Defender, CFA=0, tanpa ASR, 0 event blokir), bukan binary (`workerd --version` OK), bukan ACL repo (`mkdirSync` rekursif pada path sama OK). **Akar: workerd hanya bisa membuat folder di dalam folder project** — replikasi 4/4: `Temp`, `Temp\mfnest`, `C:\Users\USER\.mftmp`, `Documents\mftmp` ❌ vs `<project>\node_modules\.cache\mftemp` ✅. Workaround (tanpa ubah repo/admin): set `TEMP`/`TMP` ke folder dalam project hanya selama `npm run deploy`, dihapus sesudahnya. **Deploy #2 sukses**: gate OK (473 file, 0 blocker), build 67/67, **59 entri** KV incremental remote, 19 aset baru/diubah, **Version ID `163a5779-d070-4b9d-b828-b4e6e7fb525a`**. Verifikasi produksi semua PASS (`verify-prod-after-deploy.mjs`): HTML kedua preview `?v=2` + nama baru tanpa "macOS Monterey", 3 file `public/wallpapers` kini frame Hunt (`1CFFD9DC9243…`/`B6E94B1905C7…`), poster R2 bare & `?v=2` = `B3ECD5F8…`, halaman lain 200, browser sesi bersih request poster `?v=2` + desktop penuh tanpa foto orang + 0 error console. Follow-up: pantau ISR produksi (sebelum deploy `revalidate=60` tidak pernah commit); `/api/revalidate` tidak menyentuh `/preview/*`.

120.  **[Investigasi ISR Background Revalidation Tidak Pernah Commit + `/preview/*` Ditambahkan ke `/api/revalidate` (v1.3.8)](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/isr_revalidation_investigation_2026_09_28.md)**
      - _Status:_ 🟠 Kode + deploy selesai (v1.3.9, Version `cd763c10-630d-4dad-aa42-e34b8adfa102`); **verifikasi perilaku ISR tertunda** karena kuota baca KV Cloudflare harian habis
      - _Isi:_ Tindak lanjut follow-up entri 119. (a) **Kode:** `src/app/api/revalidate/route.ts` kini ikut `revalidatePath` untuk `/preview/os-desktop`, `/preview/infinite-canvas`, `/preview/spatial-gallery` (+ test baru). Gate: tsc 0, eslint 0, **113 files / 857 tests PASS**. (b) **Akar masalah ISR time-based ditemukan:** `open-next.config.ts` memakai `queue: 'direct'` yang ternyata = `@opennextjs/aws/dist/overrides/queue/direct.js`, object bernama literal **`dev-queue`** — me-revalidate dengan `fetch()` ke **URL publiknya sendiri** dari dalam Worker dan **tidak pernah memeriksa hasilnya**. Build memperingatkan _"not recommended for use in production"_, dan dokumentasi resmi OpenNext Cloudflare menegaskan: _"`direct` mode ... only works in preview mode (i.e. `wrangler dev`)"_. Bukti empiris produksi: `x-opennext-cache` `/preview/*` = `STALE` 6/6 selama 75 dtk; **GET saat STALE cuma 135–868 ms** sedangkan HEAD revalidasi manual identik butuh **6.113–9.489 ms** → `REVALIDATED` → `HIT` (bukti mekanisme sehat, yang gagal justru pemanggilan otomatisnya). Tersangka dibantah: CDN (`cf-cache-status` selalu `-`) dan `NEXT_PREVIEW_MODE_ID` (id `1b039c6b…` konsisten dan diterima produksi). (c) **Tambahan:** `revalidatePath('/', 'layout')` **tidak** menutup `/preview/*` — tag yang ditulis Next = `_N_T_/layout`, sedangkan tag cache `kv-next-tag-cache` `mode='nextMode'` menilai staleness dari tag entri; diverifikasi 2x (30 dtk & **90 dtk**, di luar jendela propagasi KV) → tetap `STALE`, `bytes` identik `85764`. Kesimpulan: **`/projects` dan `/preview/*` kini hanya segar saat deploy** (menjelaskan insiden entri 119). `REVALIDATION_TOKEN` **ada** di produksi (401 vs 500). Perubahan (a) kemungkinan besar works karena `revalidatePath('/preview/os-desktop')` menulis tag `_N_T_/preview/os-desktop` = tag implisit halamannya sendiri, tapi **belum diverifikasi end-to-end**. Opsi perbaikan sudah dieksekusi sesuai pilihan owner: `queue` diganti ke **memory queue** (`@opennextjs/cloudflare/overrides/queue/memory-queue`) + binding `services: WORKER_SELF_REFERENCE` ditambahkan di `wrangler.jsonc` (persis template resmi OpenNext yang sebelumnya absen), lalu deploy sukses **Version `cd763c10-630d-4dad-aa42-e34b8adfa102`** — bundle kini `memory-queue` = 6 file, **`dev-queue` = 0 file**. Namun verifikasi perilaku **terblokir**: `wrangler tail` menangkap `Failed to get from cache: KV get() limit exceeded for the day` di setiap route ter-cache → `x-opennext-cache` hilang, TTFB `/preview/*` naik 150 ms → 6–17 dtk, dan `Revalidation failed` = 0 (memory queue belum sempat jalan karena `incrementalCache.get()` melempar duluan). Bukan read storm (terukur 2 KV get/request, trafik ±1,5 req/menit); entri KV 59 key masih ada. Kuota diharapkan reset 00:00 UTC → **wajib ulangi verifikasi setelah itu** (rollback ke `163a5779-…` tidak menolong, kegagalan di akun/kuota bukan di konfigurasi).

121.  **[Pipeline Analitik Pengunjung: blob 100 entri yang tak pernah dibaca -> D1 site-scoped + Panel Admin (v1.3.10)](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/visitor_analytics_pipeline_2026_09_28.md)**
      - _Status:_ 🟡 Kode + verifikasi runtime selesai; **panel UI belum dilihat di browser** (membaca datanya butuh login admin, `.env.local` hanya berisi hash `ADMIN_PASSWORD_SCRYPT`)
      - _Isi:_ Dipilih owner dari tiga opsi usulan fitur (backlog resmi kosong). Audit menemukan **3 lapis analitik tak saling tersambung**: capture `useAnalytics` menumpuk di JSON `analytics/logs` kapak **100 entri** (1 read + 1 write array per event, terlama terbuang) dengan cuma **3 event langka dan tanpa `page_view`**; `analyticsService` + tabel D1 `site_analytics` (Sprint 63) **0 importer**; `GET /api/analytics` **0 konsumen UI**. Perbaikan: beacon `PageViewTracker` di **root layout** (sengaja bukan route-group `(site)` karena `page.tsx` homepage ada di root, jadi dipasang di `(site)` akan melewatkan `/`; skip `/admin` + `/setup`; guard ref anti ganda karena StrictMode) -> `POST /api/analytics` -> **UPSERT 1 baris D1** -> `GET` -> **panel "Statistik Pengunjung"** baru di zone _Sistem & Tampilan_ (`registry.ts` + `PANEL_MAP` + route `/admin/system/analytics`), memakai pola React Query admin (`ADMIN_QUERY_KEYS.analytics` + `fetchAdminAnalytics`). **Perubahan perilaku yang dilaporkan:** tulisan `audit_logs` di `recordHit` dihapus (1 kunjungan = **1 write D1**, sebelumnya 2, dan jejak keamanan tidak lagi tercampur baris analitik); `GET` mengembalikan `{ summary }` menggantikan `{ logs }`; `event` di luar allowlist kini **400**; `target_slug` `page_view` di-bucket ke segmen route yang dikenal (`/projects/abc` -> `/projects`, sisanya `/lain`) agar endpoint yang terbuka untuk pengunjung tidak bisa membuat baris D1 tanpa batas (baris per site kini terkunci: 8 bucket halaman + 1 `main` per event + `/lain`); `catch` POST kini melog error sebelum balas 500; deskripsi zone `system` ikut disesuaikan. Rate limit 30 req/60 dtk dipertahankan. **Gate: tsc 0, eslint 0, `113 files / 863 tests PASS` (6 test baru).** **Verifikasi runtime:** `page_view` 200, event di luar allowlist 400, payload kosong 400, `GET` tanpa login 401, `/admin/system/analytics` 307 ke login, halaman publik 200; **bukti tulis ke D1 remote terbaca langsung lewat Cloudflare API** (`/projects`, `/about`, `/`, `/preview`) dan bucketing terbukti di data nyata (input `/projects/some-project` tersimpan sebagai `/projects`). **Temuan sampingan belum ditangani:** app **Asisten AI tidak ada di `PANEL_MAP`** (klik dari folder zone menampilkan "Panel ai belum tersedia"); `FEATURE_ANALYTICS="false"` tetap tidak dipakai; beacon belum menjangkau route `[siteSlug]`; `project_view`/`app_view` belum punya emitter sehingga dua bagian panel baru muncul setelah beacon ditambahkan; `AdminConstants.ts` (`NAV_ITEMS`) dead code.

122.  **[Security Audit Alur Login, Pembayaran & API - 2026-09-29](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/security_audit_flow_2026_09_29.md)**
      - _Status:_ [OK] Audit selesai - **seluruh temuan (4 HIGH / 8 MEDIUM / 7 LOW) di-remediasi & diverifikasi** (gate: tsc 0, eslint 0, seluruh suite vitest PASS)
      - _Isi:_ Analisis keamanan 3 lapis: auth/login, billing/pembayaran, dan attack surface API lain. 4 HIGH (`GET /api/settings` publik bocorkan hash `settings/adminPassword`/`adminPin` bila key ada; rate limit key `ip|User-Agent` bisa dibypass rotasi UA di 19 route; endpoint AI publik `translate`/`chat/*` memakai API key owner; `/api/setup` terbuka tanpa auth+rate limit), 8 MEDIUM (webhook Telegram tanpa cek chat admin, CSRF allowlist `startsWith`, JSON-LD tanpa escape `<`, CSP `unsafe-inline` + jalur static-asset keluar middleware, delete icons tanpa guard prefix, `passthrough()` settings schema, proof-upload reset timer auto-cancel 7 hari, flood checkout habiskan pool nominal), 7 LOW. Tanpa temuan Critical; tidak ada SQLi/hardcoded secret/alg=none. Log detail: `docs/tracker/logs/security_audit_flow_2026_09_29.md`. **Remediasi bertahap HIGH -> MEDIUM -> LOW (21 file source):** allowlist publik settings, key rate limit IP-only + kuota harian translate 200/24jam + limit setup/checkout/slug/telegram webhook, guard chat-admin webhook + timing-safe + sanitasi WA, CSRF match per-segmen, escape `<` JSON-LD (3 file), header keamanan jalur static-asset + samakan HSTS/Referrer, guard prefix hapus icon, schema settings `.strict()`, timer proof tak bisa di-reset upload ulang, `template_id` ikut INSERT, cleanup R2 bukti saat cancel/sweep, token order kadaluarsa 90 hari, klaim `siteId` di `admin_token` + cek siteId di middleware, SQL `'activated'` & error.message generik. Catatan sisa (butuh keputusan owner): CSP nonce penuh, verifikasi env produksi. **Tambahan 2026-09-30:** verifikasi produksi selesai (key `settings/adminPassword`/`adminPin` TIDAK ada di D1 prod -> HIGH #1 murni pencegahan; `TELEGRAM_ADMIN_CHAT_ID` terisi; route `/r2` menolak prefiks `orders/`, uji live `/r2/assets/...`=200 vs `/r2/orders/...`=404 -> bukti transfer tidak terekspos). Verifikasi itu menemukan 1 bug fungsional baru: tombol "Lihat Resi" admin selalu 404 untuk bukti hasil upload file. Diperbaiki dengan endpoint baru `GET /api/billing/orders/[orderId]/proof` (cek sesi admin ATAU token order -> stream R2 `cache-control: private`), 13 test baru, tombol modal dialihkan ke endpoint itu (CHANGELOG 1.3.12). Pengeras CSP tanpa-risiko (`object-src`/`base-uri`/`form-action`/`frame-ancestors`) ternyata sudah ada sejak sebelum audit; nonce CSP tetap ditunda. Semua sudah di-commit di cabang `fix/security-audit-2026-09-29` (7 commit; **merge ke `main` ditunda** karena repo `main` sedang dikerjakan AI lain pada file yang sama).

123.  **[Hardening Keamanan Alur Order & Billing — Tahap 4–5 Audit (v1.3.18)](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/security_order_billing_hardening_2026_10_02.md)**
      - _Status:_ 🟢 Completed (lokal; deploy menunggu perintah owner)
      - _Isi:_ Enam perbaikan bertarget pada alur order/billing hasil audit tahap 4–5, tanpa mengubah UX: (1) **#4 Referrer leak token order** — `src/app/orders/layout.tsx` **baru**: header `Referrer-Policy: no-referrer` + meta `robots noindex,nofollow` menutup kebocoran URL token ke situs pihak ketiga saat pembeli klik link bank/medsos; fitur salin-link tetap utuh. (2) **#7 SSRF guard bukti bayar** — `orderService.ts:245` `normalizePaymentProofUrl()` menolak localhost/loopback/RFC1918/169.254/CGNAT sebelum fetch. (3) **#8a Audit trail upload bukti** — `orders/[orderId]/route.ts:116` panggil `logActivity('billing.proof_upload', ...)`. (4) **#8b Audit trail cancelOrder** — `orderService.ts:1046` `logActivity('billing.order_cancel', ...)` sebelum return sukses. (5) **#5 Rate-limit checkout** — cap per-IP sudah aktif via `enforceRequestRateLimit`; ditambah same-origin guard di handler `checkout/route.ts`. (6) **#3 CSRF billing (Opsi A)** — `middleware/csrf.ts` fallback Same-Origin untuk endpoint publik tanpa cookie. (7) **#2 Webhook timing-safe** — `telegram/webhook/route.ts` pakai `crypto.timingSafeEqual` + length guard. **Gate final: Vitest 61 passed / 61 (4 file test: middleware ×3 + orderService), nol regresi.** Diff stat terverifikasi `git diff --stat`: 5 modified + 1 untracked baru, **+149/-5** (6 file). Sisa backlog audit #6 (konsistensi guard Admin vs Customer) = refactor terpisah, bukan hole aktif → ditunda.
      - _Tambahan batch kedua (ikut ter-commit, didokumentasikan oleh AI sesi ini):_ **panel "Log Aktivitas"** baru di zone _Sistem & Tampilan_ — `ActivityLogPanel.tsx` (baru) + `registry.ts` (id `activityLog`, `APP_ROUTE_MAP.activityLog`) + `WindowContentRenderer.tsx` (`PANEL_MAP.activityLog`), didukung `GET /api/admin/audit-logs` yang kini **menggabungkan dua sumber sejarah**: blob `app_kv` + tabel relasional `audit_logs` (`Promise.all` → dedup by id, kv menang karena metadata lebih kaya → sort desc → 50 entri; kegagalan baca tabel ditelan agar viewer tetap jalan). **Rute `/admin/system/activity-log/page.tsx` dibuat AI sesi ini** karena `APP_ROUTE_MAP` menunjuk ke halaman yang tidak ada (satu-satunya entri tanpa `page.tsx` → deep-link langsung 404). **Perbaikan lint AI sesi ini:** error `react-hooks/set-state-in-effect` di `ActivityLogPanel` (panggilan `fetchLogs()` sinkron di effect) diselesaikan dengan menjadwalkan pemuatan awal via `setTimeout(…, 0)` — pola yang sama dengan `OrdersPanel` — tanpa mengubah perilaku. **Gate: tsc 0, eslint 0, `113 files / 863 tests PASS`.** Panel UI belum dilihat di browser (membaca datanya butuh login admin).

124.  **[Email Serah-Terima Saat Order Diaktifkan (v1.3.13)](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/activation_handoff_email_2026_10_02.md)**
      - _Status:_ 🟢 Selesai (tsc 0, eslint 0, `114 file / 879 test PASS`); **belum di-deploy**
      - _Isi:_ Fitur pertama dari tiga usulan setelah audit (owner memilih ini). Temuan: email cuma dikirim saat order **dibuat** (struk, `orderService.ts:661`) dan saat **kedaluwarsa** (136/175) — momen **diaktifkan** (`activateOrder`, 838–990) tidak pernah memberi kabar pembeli, link website-nya hanya muncul di pesan Telegram admin. Ditambahkan `sendActivationEmail()` (pola identik `sendOrderEmail`, guard `NOTIFICATION_PROVIDER=resend` + API key, escaping pakai helper lama `escapeTelegramHtml`, `amount` defensif) dipanggil sekali dari `activateOrder` setelah `siteUrl` dihitung dan **dibungkus try/catch** (aktivasi sudah ter-commit ke D1, email gagal tidak boleh menggagalkan). **Sengaja tidak dimasukkan:** tautan `/admin` (panel operator via `SITE_ID`, bukan pembeli) dan `/{slug}/login` (rute alias `src/app/[siteSlug]/login/page.tsx` -> `/client/login` yang **tidak ada** = 404, sisa penghapusan sistem login klien `686f762`). Tidak ada email ganda: jalur "sudah diaktifkan sebelumnya" return awal. 3 test baru (terkirim + provider gagal + provider belum dikonfigurasi), `afterEach` mengembalikan env & `vi.unstubAllGlobals()`. **Handoff:** (1) rute mati `/{slug}/login` perlu keputusan owner (hapus atau arahkan); (2) usulan berikutnya = **cron harian Wrangler** (`wrangler.jsonc` **tidak punya `crons` sama sekali** -> `sweepExpiredOrders` cuma jalan saat admin buka panel Order, backup `backup-d1.ts`/`backup-r2-site-media.ts` masih manual) dan pemindahan `JWT_SECRET`/`PASSWORD_SALT`/`TELEGRAM_BOT_TOKEN` ke Worker secrets.

125.  **[Pembersihan Rute Login Klien Mati + Penghapusan Alias Admin /portal (v1.3.14)](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/cleanup_dead_client_login_2026_10_02.md)**
      - _Status:_ 🟢 Selesai (tsc 0, eslint 0, `114 file / 879 test PASS`); **belum di-deploy**
      - _Isi:_ Permintaan owner: _"/{slug}/login hapus, /portal juga hapus aja"_. Sebelum eksekusi dipastikan dulu bahwa `/portal` **bukan rute mati melainkan alias tersembunyi `/admin`** (3 rewrite `next.config.mjs`), dan bahwa menghapusnya **tidak mengunci owner** — unauthenticated ke `/admin` sudah dijawab redirect ke `/admin/login` oleh `customer-auth.ts:118`. Dihapus: rute `src/app/[siteSlug]/login/page.tsx` (isinya cuma redirect ke `/client/login` yang tidak ikut ada), 3 rewrite `/portal`, `'/portal'` dari `protectedRoutes` + `'/portal/login'` dari `publicRoutes` (`src/middleware/constants.ts`), `pathname === '/portal/login'` di `ClientAdminLayout`, tombol **"Login Client"** + **"Atur Password"** di `orders/[orderId]/page.tsx` (keduanya 404; ikon `KeyRound` ikut dilepas), blok **"Login client:"** di `MasterSiteEditorSidebar` (pembungkus `custom domain` diganti kondisi `activeSiteDraft.customDomain?.trim()` supaya **Custom Domain tetap tampil**), dan `clientLoginPath` dari `ClientDashboardPanel`. **Logo mata tetap ada** tapi diganti `<Link href={effectiveLoginUrl}>` -> `<div role="img" aria-label>` atas permintaan owner — seluruh perhitungan `effectiveLoginUrl` + prop `siteId`/`siteSlug`/`loginUrl` di `MenuBar` dihapus, lalu rantai `loginUrl` dibersihkan sampai ke sumber (`UIOverlaysLayer`, `DesktopEnvironment` x4 titik + `DesktopMainBaseProps`). `DesktopEnvironmentProps.siteSlug` **dipertahankan** karena masih diteruskan `OSDesktopRenderer.tsx:40`; `SecretEyeLogin` di `CanvasControls` tidak disentuh (loginUrl default preview masih berfungsi). **10 file, +18/−98.** Gate: tsc 0, eslint 0, 879 test PASS, sisa rujukan mati = 0. **Handoff:** owner wajib tahu admin kini **hanya** lewat `/admin` & `/admin/login` (bookmark `/portal` mati); tombol di halaman order harus dikembalikan bersama rutenya bila portal klien kelak dihidupkan lagi; verifikasi visual logo mata & perilaku logout masih butuh browser/deploy.

126.  **[Hapus Konsep Paket Lite/Pro + Langganan Tanpa Jejak (v1.3.15)](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/remove_lite_pro_plan_2026_10_03.md)**
      - _Status:_ 🟢 Selesai (tsc 0, eslint 0, `114 file / 879 test PASS`); **belum di-deploy, database produksi belum disentuh**
      - _Isi:_ Permintaan owner: _"hanya paket lite dan pro itu tidak ada, pembeli masih bisa pesan lewat website"_ + _"hilangkan bersih tanpa jejak di github, file, dan code"_. **Alur jual-beli TIDAK dihapus** — `/checkout` → order → bayar → upload bukti → verifikasi → aktivasi tetap jalan, harga tetap `Rp199.000` (terbukti `getBasePlanAmount('lite') === getBasePlanAmount('pro') === 199000`, jadi penghapusan pilihan paket **tidak mengubah nominal**). Yang dihapus: tipe `ProductPlan`/`PlanQuota`, `PLAN_BASE_PRICES`, `sitePlan.ts` (digabung ke `siteQuota.ts`), `plan` dari SELECT/INSERT `sites` & `orders`, tabel `site_subscriptions` + `billingStatus`/`currentPeriodEnd`/`quotaDefault`/`billing` dari respons & tipe admin, **dropdown Plan** `MasterSiteEditorSidebar` + badge Plan `MasterSiteTable` (diganti `site.status`), baris "Paket Terpilih" di halaman order, "Paket & Slug" → "Slug" di `OrdersPanel`, baris `Paket:` di 4 email + 2 pesan Telegram, INSERT `site_subscriptions` di `activateOrder`, env `PLAN_LITE_*`/`PLAN_PRO_*`/`AI_MONTHLY_TOKEN_LIMIT_*` (diganti `PROJECT_LIMIT`/`STORAGE_MB`/`MEDIA_PER_PROJECT`), `checkPlanQuotas` & `planStorageMb` di skrip, flag `--plan` load test, dan `docs/release/LITE_PRO_SCOPE.md` (+ `SALES_PRICING.md` ditulis ulang jadi satu harga tanpa langganan). **`errorCode` `PLAN_QUOTA_VIOLATION` → `QUOTA_VIOLATION`**. 68 file (kode/skrip/test/dokumen), 1 file dihapus, 2 rename (`plans.ts` → `pricing.ts`, `sitePlan.ts`). **Tanpa jejak di: kode, skrip, test, dokumen aktif, env — 0 match**; riwayat git tidak di-rewrite dan arsip `docs/tracker/logs` + entri INDEX lama sengaja dibiarkan. **Database: kode dulu, data belakangan** — skrip `scripts/cloudflare/remove-plan-columns.ts` (dry-run default, `--apply` untuk eksekusi) **SUDAH DIBUAT tapi BELUM DIJALANKAN**; urutan wajib = deploy dulu → baru `--apply`. Bug yang diperbaiki selama pengerjaan: pabrik `vi.mock('@/lib/product/siteQuota')` di `route.test.ts` hanya menyediakan 2 ekspor sehingga menutupi `getEffectiveSiteQuota`/`normalizeSiteQuotaOverride` setelah penggabungan `sitePlan.ts` (6 test gagal -> diubah ke pola `importOriginal` + spread). **Handoff:** (1) `release:sale-readiness` sudah rusak **sebelum** pekerjaan ini — 4 cek menunjuk file fitur reset-password yang sudah dihapus (`src/app/api/client/password-reset/*`, `src/app/client/reset-password`, `src/lib/clientPasswordReset.ts`), butuh keputusan owner: hapus cek mati atau hidupkan lagi fiturnya; (2) lanjutan yang sudah di-izin = **"sambungkan kasir ke bengkel" (v1.3.16)**; (3) merge ke `main` + `pre-deploy` masih menunggu AI lain selesai.

127.  **[Hapus Jejak Fitur Reset Password + Sambungkan Kasir ke Bengkel (v1.3.16)](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/bengkel_handoff_reset_trace_2026_10_03.md)**
      - _Status:_ 🟢 Selesai (tsc 0, eslint 0, `114 file / 881 test PASS`, `release:sale-readiness` 13/13); **belum di-deploy, database produksi belum disentuh**
      - _Isi:_ 3 poin yang diminta owner. **(1) Database:** dry-run `remove-plan-columns.ts` dijalankan ke D1 produksi dari repo utama (worktree tidak punya `.env.local`) — **semua `[ada]`**, termasuk `DROP TABLE client_password_resets` yang baru ditambahkan sesi ini; `--apply` **ditahan** sampai deploy karena panel admin/kasir yang tayang masih membaca kolom `plan`. **(2) Reset password:** owner pilih _"Hapus semua jejaknya"_ — grep `PASSWORD_RESET|password-reset|clientPasswordReset` di `src/` = **0 match** (fitur mati sejak `686f762`), jadi yang dibersihkan hanya sisa-sisanya: 5 cek di `audit-sale-readiness.js`, 2 frasa + 2 key env di `audit-release-package.js`, `checkClientPasswordReset` (`production-readiness.ts`) diganti `checkNotificationProvider`, 2 key di `product-env.ts` + `.env.example`, cek `/client/reset-password` di `synthetic-production-check.js` + `smoke-production.js`, list tabel di `backup-common.ts`/`audit-restore-integrity.ts`, flag `--password-reset-mode` + endpoint 404 di `multi-buyer-load-test.js`, dan **13 dokumen aktif**. **`src/` aplikasi tidak diubah sama sekali.** `reset-customer-password.ts` **dipertahankan** (jalur reset owner-assisted untuk `/admin/login` yang masih hidup, bukan fitur self-service). Gate audit: `release:sale-readiness` **17/22 (EXIT 1) → 13/13 (EXIT 0)**; `release:audit` tetap EXIT 1 dengan sisa **2 gagal pre-existing** (key `TELEGRAM_*` di `.env.example` vs pola `forbiddenEnvPatterns`, dan frasa `manual invoice` yang memang tidak pernah ada di `docs/`). **(3) Kasir → bengkel:** ditemukan bahwa order `activated` **tidak pernah memberi owner apa pun** (Telegram hanya meng-edit tombol jadi "ACTIVATED"), padahal pekerjaan berikutnya 100% manual. Ditambahkan `sendWorkshopTicket()` di `orderService.ts` (dipanggil sekali di akhir `activateOrder` setelah email, best-effort, guard token) berisi ID/slug/nama/WA/email/URL + **6 langkah bengkel**, dirujuk ke runbook baru `docs/operations/BENGKEL_HANDOFF.md` yang disusun dari fakta kode (4 menu `PENGELOLA_KLIEN.bat`, API `/api/verify` `/api/provision` `/api/deploy-client`, `arsip-klien/<folder>/config.env`). **2 test baru** (tiket terkirim; aktivasi tetap sukses tanpa Telegram = 0 request). **Handoff:** (1) deploy → baru `--apply`; (2) sisa jejak sistem login klien **v1.3.14** di 8 lokasi dokumen + `multi-buyer-load-test.js:686` (uji beban masih memanggil `POST /api/client/login` yang sudah tidak ada) butuh keputusan owner; (3) 2 gagal `release:audit` pre-existing; (4) merge ke `main` masih menunggu AI lain.

128.  **[Sisa Jejak Login Klien di Dokumen & Uji Beban + 2 Kegagalan Audit Rilis (v1.3.17)](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/cleanup_client_login_docs_audit_2026_10_03.md)**
      - _Status:_ 🟢 Selesai (tsc 0, eslint 0, `114 file / 881 test PASS`, `release:audit` **62/62**, `release:sale-readiness` 13/13); **merge + deploy ditahan** (repo utama kotor oleh AI lain), database produksi belum disentuh
      - _Isi:_ Balasan owner **"1,2,3,4"**. **Dikerjakan = poin 3 & 4.** **(3) Sisa jejak sistem login klien:** diverifikasi dulu ke kode bahwa `src/app/api/client/` **nol file**, `/{slug}/login` & `/client/dashboard` tidak ada, dan mutasi konten butuh `site_user_token` dari `POST /api/auth/login` (`siteMutationAuth.ts:12-14`) — jadi **15 dokumen aktif** yang menjanjikan pintu roboh itu diluruskan ke kenyataan (`/admin/login`, dashboard `/admin/client-dashboard`, reset selalu owner-assisted): 6 di `docs/release/`, 4 di `docs/operations/`, 4 di `docs/agent-context/`, 1 di `docs/product-boundary/`; termasuk contoh respons berisi `"plan": "lite"` yang lolos dari v1.3.15. `src/` **tidak diubah sama sekali**. **`multi-buyer-load-test.js` diperbaiki, bukan dihapus:** skrip memanggil **4 endpoint mati** (`/api/client/login`, `client-access`, 2 upload client) sehingga mustahil jalan sejak v1.3.14 → sesi jadi `visitor` (anonim) + `siteUser` baru (`createSiteUserSession`, env `LOAD_TEST_SITE_USER_EMAIL`/`_PASSWORD`), upload dialihkan ke `/api/admin/sites/:id/...` (kontrak diverifikasi ke route: field `file`, respons `publicUrl`/`key`/`uploadUrl`), dan **bug token admin diperbaiki**: `buildAdminToken()` tidak mengirim klaim `siteId` padahal `verifyAdminToken()` menolaknya sejak audit 29 Sep. **Check isolation lintas-tenant di-retire dengan alasan eksplisit** (dulu butuh 1 login per tenant; sekarang hanya 1 akun panel → check akan selalu lolos palsu). Verifikasi: `node --check` 0 + dry-run 2 tenant **exit 0**; `--run-live` belum pernah dijalankan. **(4) 2 gagal `release:audit`:** (a) pola `/^TELEGRAM_/` dihapus dari `forbiddenEnvPatterns` karena bot Telegram kini **fitur produk** (notifikasi order + tiket bengkel), larangan Firebase/Vercel/job-bot & pola npm script tetap; (b) frasa wajib `manual invoice` dipenuhi dengan **meluruskan dokumen** (`SALES_PRICING.md` → _"Pembayaran manual invoice (QRIS/transfer)..."_), guard tidak dihapus. **Audit rilis 60/62 (EXIT 1) → 62/62 (EXIT 0).** **DITAHAN (poin 1 & 2, bukan dilupakan):** `git status` repo utama menunjukkan **10 file ter-modifikasi + 3 file baru belum di-commit** milik AI lain — termasuk `CHANGELOG.md` & `docs/tracker/INDEX_TRACKER.md` (bentrok ganda) dan 2 file yang sudah jadi bentrok cabang (`telegram/webhook/route.ts`, `middleware/csrf.ts`); merge sekarang = menimpa pekerjaan orang, deploy sekarang = mengirim setengah jadi. **Handoff:** (1) urutan benar = AI lain commit → merge → `pre-deploy` → `cf:deploy` → **baru** `remove-plan-columns.ts --apply`; (2) **keputusan owner:** tabel `client_access` (4 baris email+hash pembeli, 0 kode membaca) ikut `DROP` saat `--apply` atau disimpan?; (3) uji beban live butuh kredensial panel + keputusan soal isolation per-tenant.

129.  **[Merge Cabang Rilis, Deploy Produksi & Pembersihan Database (v1.3.18)](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/merge_deploy_db_cleanup_2026_10_03.md)**
      - _Status:_ 🟢 Selesai (deploy produksi + `--apply` database sudah dijalankan); **sudah di-push ke GitHub** (`git push origin main` → `b40f12c..5609db4`)
      - _Isi:_ 4 poin owner dieksekusi berurutan. **(1) Lint:** satu-satunya error `eslint src` di repo utama (`react-hooks/set-state-in-effect` di `ActivityLogPanel`, `fetchLogs()` dipanggil sinkron dari effect) diperbaiki dengan menjadwalkan pemuatan awal lewat `setTimeout(…, 0)` — pola yang sama dengan `OrdersPanel`; percobaan memindahkan `setState` ke tombol gagal karena rule itu konservatif terhadap pemanggilan fungsi komponen dari effect. **(2) Commit pekerjaan AI lain** (`eb5bfeb`, 14 file, +579/−23): 6 hardening order/billing **plus batch kedua yang belum mereka catat** — aplikasi "Log Aktivitas" + `GET /api/admin/audit-logs` yang kini menggabungkan blob `app_kv` dengan tabel relasional `audit_logs`; AI sesi ini melengkapi `src/app/admin/system/activity-log/page.tsx` (**satu-satunya entri `APP_ROUTE_MAP` tanpa `page.tsx`** → deep-link pasti 404) plus dokumentasi CHANGELOG/INDEX. **(3) Merge** `fix/security-audit-2026-09-29` → `main` (`dc27edc`), 5 konflik: label `1.3.11` dimiliki dua entri berbeda → versi milik `main` dinaikkan jadi **`[1.3.18]`**; baris _Isi_ INDEX entri 121 di `main` **terpotong 2015 vs 2509 karakter** (`… [truncated]`) dipulihkan dari versi cabang, entri cabang digeser 122–127 → 124–128; checkout mempertahankan **kedua** perubahan (guard same-origin + rate limit 5 request/menit); webhook memakai `safeEqual` (`crypto.timingSafeEqual`); `orderService` memakai `logActivity` + `BASE_PRICE` (dengan `grep` membuktikan 0 rujukan `PLAN_BASE_PRICES`). Setelah merge muncul **3 error TS2790** (`delete process.env.NOTIFICATION_PROVIDER`) yang **hanya terjadi di repo utama** karena `cloudflare-env.d.ts` (gitignored, hasil `wrangler types`) mendeklarasikan key itu wajib → helper `unsetEnv()`. **(4) Deploy + database:** deploy gagal 1× dengan insiden workerd `CreateDirectory` yang sudah terdokumentasi (entry 119) → workaround `TEMP`/`TMP` ke `node_modules\.cache\mftemp` → **sukses, Version ID `dd3385e7-b758-47e0-9cb1-6b6a185f3d47`**; smoke produksi **6/6**; **baru kemudian** `remove-plan-columns.ts --apply` dengan tambahan **`DROP TABLE client_access`** (keputusan owner: hapus tanpa ekspor) → **6/6 `[ok]`**, verifikasi ulang **6/6 `[n/a]`** (_"Database sudah bersih"_), smoke ulang **6/6**, `cf:live-check` ok. Dibersihkan juga 2 baris mock mati (`existingClients`, `insert client_access`) di `orderService.test.ts`. Gate: tsc 0, eslint 0, **114 file / 881 test PASS**, `release:audit` **62/62**, `release:sale-readiness` **13/13**, `pre-deploy` EXIT 0 (478 file, 0 blocker). **Handoff:** belum push (ahead 20), cabang rilis + worktree belum dihapus, **cron harian Wrangler** & **pemindahan rahasia ke Worker secrets** masih tertunda, panel "Log Aktivitas" belum dilihat di browser.

130.  **[Cron Harian Cloudflare + Pemindahan Rahasia ke Worker Secrets (v1.3.19)](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/cron_worker_secrets_2026_10_03.md)**
      - _Status:_ 🟢 Selesai (tsc 0, eslint 0, `115 file / 887 test PASS`, `release:audit` **62/62**, `release:sale-readiness` 13/13); deploy produksi sukses **Version ID `6f2bd3ae-1b2d-4ebe-9bef-19fbd7f3002e`** dengan `schedule: 0 18 * * *`, `wrangler secret list` = **12 key**, smoke **6/6**; **fire cron pertama (01:00 WIB, 4 Okt) menunggu verifikasi akhir**
      - _Isi:_ Dua pekerjaan pilihan owner — push sudah beres di entri 129, ini bagian _"Cron harian + rahasia Worker"_. **(1) Cron harian:** `sweepExpiredOrders()` (sweeper order kedaluwarsa dengan guard 10 menit di `platform_settings.billing_expire_sweep_at`) sebelumnya **hanya dipanggil `GET /api/admin/orders`**, jadi kalau panel tidak pernah dibuka order tetap "pending" selamanya — dokumen kodenya bahkan sudah menulis _"dapat dijadwalkan via cron"_ tanpa ada penjadwalnya. Ditambahkan `triggers.crons: ["0 18 * * *"]` (01:00 WIB) di `wrangler.jsonc`; **field `crons` top-level ditolak schema wrangler 4.140** (`Unexpected fields found in top-level field: "crons"`) sehingga wajib memakai `triggers.crons`. Karena `@opennextjs/cloudflare` **tidak mengekspor `scheduled`** (0 match di `dist`) dan `pre-deploy-check.js:103` mengunci `main` ke `.open-next/worker.js`, handler ditambahkan oleh `appendScheduledCronHandler()` di `prepare-opennext-worker-output.js` (kini 7 patch). Handler memanggil `POST /api/cron/daily` lewat **service binding `WORKER_SELF_REFERENCE`** (binding yang memang sudah dipakai untuk ISR) memakai **`await`, bukan `ctx.waitUntil`** — versi awal `waitUntil` membuat kegagalan sunyi (promise yang reject tidak menggagalkan invocation). Endpoint baru `src/app/api/cron/daily/route.ts` memverifikasi header `x-cron-secret` vs `CRON_SECRET` dengan `crypto.timingSafeEqual` + penjaga panjang, lalu menjalankan sweeper; `/api/cron` masuk allowlist CSRF (`csrf.ts`) dan **dicatat di komentar `constants.ts`** kenapa path itu sengaja tidak masuk `protectedRoutes`/`publicRoutes` (pengaman utama ada di handler); `CRON_SECRET` kosong → run **dilewati dengan `console.warn`**, bukan error. **6 test baru.** **(2) Rahasia → Worker secrets:** `wrangler secret list` dulu **`[]`** → kini **12 key** (`JWT_SECRET`, `PASSWORD_SALT`, `ADMIN_PASSWORD_SCRYPT`, `REVALIDATION_TOKEN`, `CRON_SECRET`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_SECRET`, `TELEGRAM_ADMIN_CHAT_ID`, `NOTIFICATION_API_KEY`, `CLOUDFLARE_D1_API_TOKEN`, `CLOUDFLARE_R2_ACCESS_KEY_ID`, `CLOUDFLARE_R2_SECRET_ACCESS_KEY`) lewat skrip baru `scripts/cloudflare/put-worker-secrets.ts` (dry-run default, `--apply`, `--keys=`; output hanya nama key + status, nilai tidak pernah dicetak) + script `cf:secrets`. Dasar teknisnya: `populateProcessEnv` (`@opennextjs/cloudflare/dist/cli/templates/init.js:87-98`) menulis env Worker dulu (`=`), baru nilai build-time (`??=`) → **secret menang di runtime**, jadi rotasi rahasia tidak butuh deploy ulang dan `.env.local` tidak lagi mengendalikan produksi. Praktik produksi tidak berubah sama sekali (smoke **6/6 sebelum dan sesudah pemindahan**). `NEXT_PUBLIC_*` sengaja tidak dipindah (harus tertanam di bundle klien); `.env.local` tetap dibutuhkan `npm run dev` + script lokal, sehingga salinannya masih ikut ter-bundle (dibatasi: bundel hanya bisa diunduh pemilik akun Cloudflare). **(3) Uji & temuan:** endpoint live → **200** `{"ok":true}` dengan token, **401** tanpa/salah token. **Uji lokal `wrangler dev --test-scheduled` tidak bisa dipakai**: 1× `/__scheduled` 200 lalu `The Workers runtime crashed unexpectedly`, 1× menggantung sampai 120 s; `wrangler dev --remote` menjawab 200 `Ran scheduled event` tetapi guard DB tidak bergerak → diduga keterbatasan arsitektur dev server wrangler untuk self-referencing service binding (dua instance miniflare; lihat `cloudflare/workers-sdk#5548`), **bukan bukti kegagalan produksi** (kode `await` async mustahil deadlock di runtime produksi). **Verifikasi definitif = memantau guard `billing_expire_sweep_at` setelah fire pertama 01:00 WIB.** Insiden lain: build `.open-next` gagal `EPERM` karena sisa proses `wrangler dev` masih memegang direktori (semua proses itu dimatikan, build ulang sukses); baris `CRON_SECRET` sempat tertulis ke worktree `cosmic-rocket` karena API .NET `[IO.File]` memakai CWD proses, bukan lokasi `Set-Location` (file itu berisi hanya baris itu → dihapus, `.env.local` repo utama ditulis ulang dengan path absolut, 64 hex). **(4) Dokumentasi:** CHANGELOG `[1.3.19]`, runbook monitoring +2 bagian (_Daily Cron Trigger_, _Rotasi Rahasia_) +1 item checklist, `env-inventory.md`, `.env.example`, `.dev.vars.example`.

131.  **[Celah Env D1/R2 Klien, Hapus Kode Mati Master Dashboard & Pembersihan Dokumen (v1.3.20)](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/patch_celah_env_klien_2026_10_04.md)**
      - _Status:_ 🟢 Selesai (tsc 0, eslint 0, `115 file / 887 test PASS`, `release:audit` **59/59**, `release:sale-readiness` **12/12**)
      - _Isi:_ Tiga tugas owner berurutan. **(1) Selidiki + perbaiki celah env D1/R2 per klien** — audit membuktikan build klien selama ini memakai `.env.local` owner dan `wrangler pages deploy` mengabaikan konfigurasi (0 mekanisme per-klien ditemukan); padahal D1/R2 sudah dibuat di akun klien → kalau dipakai, data klien tercampur ke database owner. Perbaikan: `scripts/onboarding/client-deploy.ts` (BARU) dengan injeksi env 3 lapis — `buildClientEnvPlan()` override 13 kunci dari `config.env` + reset 21 kunci owner, rewrite `.open-next/cloudflare/next-env.mjs`, generate `wrangler.client.<slug>.jsonc`, `JWT_SECRET`/`PASSWORD_SALT` digenerate per klien; deploy kini **Worker per klien** (`wrangler deploy --config ...`), bukan Pages. Bukti: build dummy → 20 kunci owner **0 kemunculan** di 1.645 file `.next/server` + seluruh `.open-next`, marker klien ada, 5 panggilan D1 di-stub, `wrangler deploy --dry-run` exit 0. **(2) Hapus kode mati Master Dashboard** — 7 file (`client-dashboard/*` ±2.400 baris, `OrdersPanel`, `PaymentConfigPanel`) + flag `FEATURE_MASTER_DASHBOARD`/`FEATURE_CLIENT_DASHBOARD`; grep 0 sisa; endpoint API orders/payment-config/sites dipertahankan (billing & tooling). **(3) Dokumen** — 2 file dihapus (`buyer-onboarding-checklist.md`, `BUYER_ONBOARDING.md` isi ≥90% salah), ±25 file diperbaiki (README, AGENTS.md, PRD ditulis ulang, playbook 17 titik "Master Dashboard"→0, 3 panduan owner/klien, `.pages.dev`→`.workers.dev`). **Gap tercatat di log:** custom domain klien masih pakai API Pages (sudah diperbaiki di entri 132), literal URL owner di 5 file `src/`, E2E akun CF nyata belum, `backup-common.ts` daftar tabel masih usang.

132.  **[Custom Domain Klien Dimigrasi dari API Pages ke Worker (v1.3.21)](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/custom_domain_worker_migration_2026_10_04.md)**
      - _Status:_ 🟢 Selesai (gerbang hijau: `npm test` **116 file / 896 test PASS** termasuk 9 test baru, `tsc --noEmit` 0, `eslint src` 0, `release:audit` **59/59**, `release:sale-readiness` **12/12**; **uji nyata akun Cloudflare sungguhan LULUS** — `uji.makeitbetter.my.id` attach → situs **HTTP 200** (13 detik) → detach bersih/NXDOMAIN)
      - _Isi:_ Gap #1 entri 131 ditutup atas jawaban owner **"ya perbaiki"**. Fitur custom domain masih memakai API **Cloudflare Pages** + instruksi CNAME ke `<slug>.pages.dev` padahal deploy klien sudah Worker (v1.3.20) → tidak akan berfungsi. Perbaikan: modul baru `scripts/onboarding/custom-domain.ts` memakai API resmi **`PUT /accounts/{id}/workers/domains`** (Attach Worker Domain, izin Workers Scripts Write, body `{hostname, service}` — zone opsional, sama seperti perilaku wrangler) sehingga **Cloudflare membuat DNS record + HTTPS otomatis** dan semua instruksi CNAME manual dihapus. Disambungkan ke `server.ts` (`POST /api/custom-domain` + `/api/custom-domain/status`), `cloud-manager.ts` (aksi `domain`), dan UI portal (`index.html`: kotak "Tidak perlu atur DNS apa pun" + baris Domain/Zone/Status, pesan WhatsApp dari `buildDomainHandoverMessage`). Dokumen: `BENGKEL_HANDOFF.md` izin token → **D1, R2, Workers (Edit)** (Pages tak dipakai), panduan owner §7 tanpa CNAME. **9 unit test** memakai `cfApi` palsu (URL/body PUT persis, galat API→pesan Indonesia, jatuh zona lokal heuristik `co.id`, isi WhatsApp tanpa CNAME). **Uji nyata LULUS** (skrip baru `scripts/onboarding/uji-custom-domain.ts`, token owner tersimpan aman di `arsip-klien/uji-domain/`): attach 1,1 dtk → situs **HTTP 200** via IP DoH+`curl --resolve` dalam 13 dtk (2 hambatan non-fitur diselesaikan: cache NXDOMAIN lokal router & respons DELETE 204 tanpa body) → detach bersih (DoH A/AAAA Status 3/NXDOMAIN). Sisa: uji E2E deploy klien pertama dengan zona di akun CF berbeda; izin token minimal belum diuji.

133.  **[Bukti Fire Cron 01:00 WIB + Fitur Backup D1 Harian (v1.3.22)](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/backup_d1_cron_proof_2026_10_05.md)**
      - _Status:_ 🟢 Selesai (gerbang hijau: `npm test` **118 file / 914 test PASS** (+17 test baru), `tsc --noEmit` 0, `eslint src` 0, `prettier` 7/7 file baru, `release:audit` **59/59**, `release:sale-readiness` **12/12**)
      - _Isi:_ Dua tugas owner. **(1) Bukti cron menembak** — temuan: jadwal uji `* * * * *` ternyata **masih terpasang di server sejak 3 Okt** (catatan `cron_worker_secrets_2026_10_03.md:95` keliru — yang dilepas hanya `wrangler.jsonc` lokal; koreksi permanen ditambahkan di log itu); guard D1 bergeser tiap tepat 10 menit = pola sweep, bukan sidik jari fire harian. Uji mekanisme: `wrangler triggers deploy` (`schedule: * * * * *`) → `wrangler tail --format pretty` 215 dtk merekam **3 event `"* * * * *" @ … - Ok` + 3 log `[cron] POST /api/cron/daily -> 200`** → revert + `triggers deploy` → `schedule: 0 18 * * *` terverifikasi API (created 2026-10-05T02:42:36Z), `git diff wrangler.jsonc` kosong. **(2) Fitur Backup D1** — `src/lib/services/d1BackupService.ts` (BARU): seluruh tabel dari `sqlite_master` (dinamis, format file = `D1BackupFile` CLI), simpan ke R2 `sites/{siteId}/backups/d1/<ISO>.json`, retensi 7 terbaru, guard idempoten <20 jam; API `/api/admin/backup` (GET list / POST backup-now CSRF) + `/api/admin/backup/download` (validasi key ketat, stream); panel admin `Sistem & Tampilan → Backup Database` (tombol Backup Sekarang + Unduh); cron `/api/cron/daily` memanggil `runDailyBackup()` dalam try/catch terpisah (kegagalan backup tidak menggagalkan run). **Tidak diubah:** `DEFAULT_D1_BACKUP_TABLES` CLI (usang — butuh izin owner, aturan Ponytail), `wrangler.jsonc`. Sisa: backup pertama belum terbukti live (fire 01:00 WIB berikutnya setelah deploy); tombol Restore belum ada (belum diminta).

134.  **[Daftar Tabel Backup CLI Disamakan ke 18 Tabel (v1.3.23)](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/backup_d1_cron_proof_2026_10_05.md)**
      - _Status:_ 🟢 Selesai (uji nyata: `backup:d1 --dry-run` **18 tabel / 77 baris** tanpa `client_access`; backup→restore dry-run **validasi 18/18 cocok**; gerbang: tsc 0, eslint 0, **118 file / 914 test PASS**, `release:audit` **59/59**, `release:sale-readiness` **12/12**)
      - _Isi:_ Izin owner diberikan (_"lakukan perubahan di opsi ke 2"_) untuk merubah perilaku script lama (aturan Ponytail §0). `scripts/cloudflare/backup-common.ts`: `DEFAULT_D1_BACKUP_TABLES` **dan** `RESTORE_TABLE_ORDER` → **18 tabel** gabungan `SHARED_SCHEMA_QUERIES` + `D1_SCHEMA_QUERIES`; `client_access` (sudah DROP) dihapus. `scripts/cloudflare/restore-d1.ts` `bootstrapTarget()` kini **juga menjalankan `SHARED_SCHEMA_QUERIES`** (IF NOT EXISTS) — tanpa ini, backup baru berisi `site_users`/`site_settings`/`rate_limits`/`portfolio_templates`/`site_template_entitlements` membuat `DELETE FROM` gagal di target staging buatan `D1_SCHEMA_QUERIES` (akar masalah: dicek semua caller sebelum ubah; tabel gawean D1 tidak berubah perilaku karena IF NOT EXISTS). Verifikasi nyata: dry-run 18 tabel/77 rows/missing kosong (`site_users` 1, `orders` 12, `platform_settings` 2 ikut), backup→restore dry-run validasi 18/18. Di luar scope awalnya (tercatat di log), lalu **dibereskan di sesi yang sama** atas pertanyaan owner _("sebaiknya hapus aja atau gak?")_: `seed-restore-drill-project.ts` — dipilih **perbaiki, bukan hapus seluruh skrip** (skrip = alat uji cadangan→restore yang terdaftar `restore:seed-drill`); bagian INSERT ke `client_access` + hash password + konstanta kredensial +2 baris log dibuang sehingga `--apply` tidak crash di tengah jalan; `audit-restore-integrity.ts` punya daftar `siteScopedTables` sendiri (aman,0 baris, sengaja tidak diubah).

135.  **[Tab "Peta Bisnis" di Portal Owner — Diagram Alur + Peta Aset (v1.3.24)](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/owner_biz_map_portal_2026_10_05.md)**
      - _Status:_ 🟢 Selesai (uji browser nyata LULUS: 2 diagram ter-render **17+14 node / 20+10 edge**, `data-processed=true`; gerbang: tsc 0, eslint 0, **118 file / 914 test PASS**, `release:audit` **59/59**, `release:sale-readiness` **12/12**)
      - _Isi:_ Permintaan owner: _"diagram di admin dashboard untuk aku sendiri aja… yang cocok biar AI tau dan aku paham yang tidak paham IT"_ → pilihan owner via kuesioner: **"Alur + peta aset"** di **portal PENGELOLA_KLIEN** (bukan `/admin` — panel itu dipakai semua klien, butuh kunci env baru; portal hanya jalan di komputer owner, nol risiko bocor, preseden Client Status Board Sprint 88). Format **Mermaid** = satu sumber dua pembaca: `docs/diagrams/alur-bisnis.mmd` (3 jalur Pembeli/Sistem/Owner, pesan→bayar→bukti→aktivasi→bengkel 6 langkah→serah terima + kotak cron 01:00 WIB) dan `docs/diagrams/peta-aset.mmd` (siapa punya apa di mana: data klien di akun CF klien, rahasia di arsip lokal, uang langsung ke owner). Portal: `GET /api/diagrams` (server.ts, baca .mmd per request → versi terbaru tanpa restart) + tab ke-5 `view-map` dengan `loadBizMap()` (fetch → `import()` mermaid@11 CDN → `mermaid.run`; fallback: CDN gagal → sumber teks tetap terbaca; fetch gagal → pesan jelas). **Tidak perlu deploy** (scripts/ + docs/, tidak masuk bundle Worker). Lanjutan: vendor mermaid lokal kalau butuh luring; ubah alur = edit .mmd saja.
