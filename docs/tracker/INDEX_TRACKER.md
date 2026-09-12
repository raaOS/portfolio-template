# AI INDEX TRACKER

**MANDATORY RULE UNTUK SEMUA AI AGENT:** 
> Jangan membaca seluruh codebase atau PRD secara sembarangan. Jika Anda baru memulai sesi, baca file ini untuk mengetahui status proyek, lalu BUKA HANYA file log yang relevan di folder `logs/`. Setelah selesai bekerja, perbarui file log yang relevan.

## 📌 Status Global Proyek

**Arsitektur Saat Ini: Managed Service (1-customer-1-account)**
- 1 customer = 1 Cloudflare account → 1 D1 + 1 R2 + 1 deployment
- Owner deploy template + CRUD ke akun customer via Wrangler CLI
- Customer dapat admin panel (macOS desktop style) untuk kelola konten
- SITE_ID hardcoded per deployment, tidak ada multi-site resolution

**Fase Saat Ini:** Fondasi managed service sudah selesai (Sprint 75). Admin panel customer sudah fungsional.
**Tugas Aktif:** Backlog managed service — owner dashboard, customer dashboard, password reset, content migration.

> **ARCHIVED (Sprint 0-74):** Sprint lama mencatat evolusi dari portofolio pribadi → multi-tenant SaaS → managed service. Log sprint lama masih relevan untuk memahami *why* keputusan desain, tapi kode dan arsitektur yang dijelaskan sudah **tidak merepresentasikan kondisi terkini**. AI wajib merujuk Sprint 75+ untuk arsitektur current.

## 📂 Daftar Modul / Log Pekerjaan (Logs)
Berikut adalah daftar aktivitas yang telah atau sedang dikerjakan. Pilih log yang sesuai dengan permintaan user:

1. **[Sprint 0 - Cleanup Firebase](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_0_cleanup.md)** 
   - *Status:* 🟢 Completed
   - *Isi:* Log penghapusan env, script, dependency, dan import Firebase dari proyek.
2. **[Sprint A - Context Pack AI](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_a_context.md)**
   - *Status:* 🟢 Completed
   - *Isi:* Ekstraksi PRD menjadi 9 file spesifik di docs/agent-context/.
3. **[Sprint B - D1/R2 Backend Hardening](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_b_d1_hardening.md)**
   - *Status:* 🟢 Completed
   - *Isi:* Setup DDL schema SQL relasional (7 tabel) di `src/lib/d1-schema.ts`.
4. **[Sprint C - Frontend Data Adapters](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_c_adapters.md)**
   - *Status:* 🟢 Completed
   - *Isi:* Pola Dual-Write diaktifkan. Pembuatan DAL SQL dan Mapper UI.
5. **[Sprint D - Backend Integration & Cleanup](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_d_integration.md)**
   - *Status:* 🟢 Completed
   - *Isi:* Melengkapi READ SQL dan mengalihkan routing API `projects` ke SQL.
6. **[Sprint E - Frontend UI Migration & Cleanup](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_e_frontend.md)**
   - *Status:* 🟢 Completed
   - *Isi:* Memperbaiki *bug* posisi ikon (*overlap*) dengan mengatur ulang *spacing* Grid dan mengubah urutan slot (ala macOS).

## 🛠️ Aturan Pengisian Log
Jika membuat modul atau sprint baru:
1. Buat file baru di dalam `logs/` dengan menyalin format dari `logs/template_log.md`.
2. Tambahkan link file tersebut ke daftar di atas.

## Audit Tambahan
7. **[V6 Completion Audit](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_v6_completion_audit.md)**
   - *Status:* ✅ Resolved ( oleh Sprint 5 )
   - *Isi:* Audit klaim selesai 100%; menemukan multi-tenant, public API `siteSlug`, migrasi UI SQL, dan test API projects belum selesai. Semua gap sudah ditutup oleh Sprint 5 (multi-tenancy D1/KV, SQL loader migration, dynamic routing `[siteSlug]`, public API).
8. **[Cloudflare Product Decision Lock](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/cloudflare_product_decision_lock.md)**
   - *Status:* Completed
   - *Isi:* Mengunci keputusan full Cloudflare, Lite/Pro self-service, dan peran CRUD Master agar AI baru tidak salah asumsi Vercel/admin-only.
9. **[Sprint 1 - Product Boundary Cleanup](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_1_product_boundary_cleanup.md)**
   - *Status:* Completed
   - *Isi:* Membersihkan kontrak env produk dan menghapus integrasi personal lama dari repo template.
10. **[Sprint 2 - Cloudflare Product Bootstrap](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_2_cloudflare_product_bootstrap.md)**
    - *Status:* Completed
    - *Isi:* Menyiapkan kontrak env Cloudflare produk, guard live write, doctor offline, bootstrap schema, dan seed demo aman.
11. **[Sprint 3 - Template Personal Data Cleanup](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_3_template_personal_data_cleanup.md)**
    - *Status:* Completed
    - *Isi:* Membersihkan data pribadi/default legacy, mengganti brand ke Portfolio OS, menstandarkan AI env produk, dan menghapus runtime aktif Vercel.
12. **[Sprint 4 - Cloudflare Workers Deploy Scaffold](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_4_cloudflare_workers_deploy_scaffold.md)**
    - *Status:* Completed and locally verified
    - *Isi:* Menambahkan OpenNext/Wrangler deploy scaffold, memindahkan middleware ke Edge entry, membersihkan blocker runtime Workers, memasang pre-deploy guard Cloudflare, dan memverifikasi `cf:build` + local `wrangler dev` HTTP 200.
13. **[Sprint 5 - V6 Multi-tenancy & SQL Loader Migration](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_5_v6_multi_tenancy.md)**
    - *Status:* 🟢 Completed
    - *Isi:* Implementasi multi-tenant database & KV, migrasi project loaders ke D1 SQL relational, dynamic routing public API, dan UI setup `/[siteSlug]`.
14. **[Sprint 6 - Production Smoke Deploy](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_6_production_smoke_deploy.md)**
    - *Status:* Completed
    - *Isi:* Optimasi bundle Worker, R2 binding runtime, direct upload Worker, patch OpenNext runtime, health check Cloudflare, deploy production, dan smoke test production.
15. **[Sprint 7 - Client Dashboard CRUD Hardening](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_7_client_dashboard_crud_hardening.md)**
    - *Status:* Completed
    - *Isi:* Mengalihkan CRUD project admin/client ke D1 SQL site-aware, menambahkan quota Lite/Pro, menghapus hook Telegram personal dari CRUD project, dan memverifikasi build Cloudflare.
16. **[Sprint 8 - Client Dashboard UI](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_8_client_dashboard_ui.md)**
    - *Status:* Completed
    - *Isi:* Menambahkan UI dashboard client self-service di admin desktop, endpoint admin sites, site-aware CRUD ringan, fix deep-link window, dan verifikasi browser + Cloudflare build.
17. **[Sprint 9 - Site-Scoped Project Media Upload](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_9_site_scoped_project_media_upload.md)**
    - *Status:* Completed
    - *Isi:* Menambahkan endpoint upload cover project scoped ke `sites/{siteId}/projects/covers/`, integrasi upload di Client Dashboard, test endpoint, dan verifikasi Cloudflare build + browser QA.
18. **[Sprint 10 - Site Storage Quota Enforcement](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_10_site_storage_quota.md)**
    - *Status:* Completed
    - *Isi:* Menghitung usage R2 per site prefix, menambahkan `usage.storage`, menegakkan quota `storageMb` untuk upload cover, dan menampilkan card Storage quota di Client Dashboard.
19. **[Sprint 11 - Client Gallery Image Upload](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_11_client_gallery_upload.md)**
    - *Status:* Completed
    - *Isi:* Menambahkan endpoint upload gallery image site-scoped, multi-upload gallery di Client Dashboard, mapping metadata `gallery`, quota storage, dan verifikasi Cloudflare build + browser QA.
20. **[Sprint 12 - Project Media Lifecycle Cleanup](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_12_project_media_lifecycle_cleanup.md)**
    - *Status:* Completed
    - *Isi:* Menambahkan cleanup R2 site-scoped saat project media diganti atau project dihapus, plus test safety prefix dan service wiring.
21. **[Sprint 13 - Site Project Media Audit](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_13_site_project_media_audit.md)**
    - *Status:* Completed
    - *Isi:* Menambahkan audit tool D1/R2 untuk prefix `sites/*/projects/`, guarded orphan deletion, dan verifikasi ulang test/build yang sebelumnya blocked.
22. **[Sprint 14 - Master Site Lite/Pro Management](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_14_master_site_management.md)**
    - *Status:* Completed
    - *Isi:* Menambahkan CRUD Master aman untuk create/update site, upgrade/downgrade Lite/Pro, suspend/activate site, dan UI Master Site di Client Dashboard.
23. **[Sprint 15 - Client Access Auth & Self-Service Dashboard](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_15_client_access_auth.md)**
    - *Status:* Completed
    - *Isi:* Menambahkan auth client site-scoped, endpoint login/check/logout client, UI akses client di Master, dan halaman `/client/login` + `/client/dashboard`.
24. **[Sprint 16 - Safe Site Delete](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_16_safe_site_delete.md)**
    - *Status:* Completed
    - *Isi:* Menambahkan hard delete site aman dengan konfirmasi slug, cleanup D1, dan delete media R2 hanya pada prefix `sites/{siteId}/`.
25. **[Sprint 17 - Video Gallery Direct Upload](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_17_video_gallery_direct_upload.md)**
    - *Status:* Completed
    - *Isi:* Menambahkan presign/direct upload video gallery site-scoped, alias client upload, whitelist signed-token direct upload, dan preview video di dashboard.
26. **[Sprint 18 - Plan & Billing Hardening](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_18_plan_billing_hardening.md)**
    - *Status:* Completed
    - *Isi:* Menambahkan metadata subscription/billing, field billing Master Site, dan guard downgrade Lite berbasis usage quota.
27. **[Sprint 19 - Production Readiness & Full Cloudflare Smoke Test](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_19_production_readiness.md)**
    - *Status:* Completed
    - *Isi:* Menambahkan gate `cf:readiness`, memverifikasi env/D1/R2/Wrangler/FFmpeg/plan quota, membersihkan warning Worker vendor output, dan smoke test Next + Wrangler lokal.
28. **[Sprint 20 - Release Packaging & Buyer Onboarding](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_20_release_packaging.md)**
    - *Status:* Completed
    - *Isi:* Menambahkan README, buyer onboarding, seller release checklist, matriks Lite/Pro, dan audit `release:audit` untuk paket jual full Cloudflare.
29. **[Sprint 21 - Production Deploy Runbook & First Release Candidate](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_21_production_deploy_runbook_rc.md)**
    - *Status:* Completed
    - *Isi:* Menambahkan production deploy runbook, RC1 release notes, production smoke script `release:smoke`, dan fix fallback R2 dev untuk `/r2/ffmpeg/*`.
30. **[Sprint 22 - Production Deploy & Smoke](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_22_production_deploy.md)**
    - *Status:* Completed
    - *Isi:* Menjalankan production deploy Cloudflare, memperbaiki blocker ukuran Worker Free dengan admin client-only panels + Wrangler minify, dan memverifikasi production smoke `8/8`.
31. **[Sprint 23 - Header PIN Entry Cleanup](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_23_header_pin_cleanup.md)**
    - *Status:* Completed
    - *Isi:* Menghapus modal PIN legacy dari klik Lottie mata di header public dan desktop OS menubar; ikon sekarang langsung menuju login admin.
32. **[Sprint 24 - Client Preview Guard](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_24_client_preview_guard.md)**
    - *Status:* Completed
    - *Isi:* Menonaktifkan link `Preview site` sampai site aktif punya minimal 1 project published, dan mengganti card preview menjadi empty state saat project masih 0.
33. **[Sprint 25 - Master Client/Project Flow Clarity](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_25_master_client_project_flow_clarity.md)**
    - *Status:* Completed
    - *Isi:* Memisahkan aksi `Client/Site Baru` dari aksi `Tambah Project ke Site Ini` agar flow Master vs project lebih jelas.
34. **[Sprint 26 - Hide Demo Seed Site From Master Dashboard](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_26_hide_demo_seed_site.md)**
    - *Status:* Completed
    - *Isi:* Menyembunyikan seed `default-site` / `demo-designer` dari Master Client Dashboard agar tidak terlihat seperti client nyata sebelum user membuat site baru.
35. **[Sprint 27 - Site Custom Quota Add-ons](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_27_site_custom_quota.md)**
    - *Status:* Completed
    - *Isi:* Menambahkan custom quota per site sebagai add-on Lite/Pro, effective quota backend, guard lowering quota, UI Master Dashboard, dan test Admin Sites.
36. **[Sprint 28 - Master Public URL Visibility](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_28_master_public_url_visibility.md)**
    - *Status:* Completed
    - *Isi:* Menampilkan Public URL, copy link, dan open link di Master Site agar URL site baru tidak perlu ditebak dari slug.
37. **[Sprint 29 - Tenant Dock Dedup](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_29_tenant_dock_dedup.md)**
    - *Status:* Completed
    - *Isi:* Memperbaiki Dock ganda pada route tenant seperti `/urgent` dengan menghindari render `GlobalDock` non-OS di tenant desktop.
38. **[Sprint 30 - Tenant Project Navigation](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_30_tenant_project_navigation.md)**
    - *Status:* Completed
    - *Isi:* Memperbaiki navigasi Projects agar site tenant seperti `/urgent` tetap menuju `/urgent/projects`, menambahkan katalog tenant, dan membuat link detail/back/filter/view mode tenant-aware.
39. **[Sprint 31 - Tenant Login Alias](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_31_tenant_login_alias.md)**
    - *Status:* Completed
    - *Isi:* Menambahkan alias login pembeli `/[siteSlug]/login` yang mengarah ke `/client/login?site=<slug>` dan auto-fill field Site slug.
40. **[Sprint 32 - Pro Testimonial Site Scope](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_32_pro_testimonial_site_scope.md)**
    - *Status:* Completed
    - *Isi:* Mengunci WhatsApp/testimoni sebagai fitur Pro-only, menambah endpoint/editor client site-scoped, menghapus fallback demo testimonial tenant, dan memblokir Dock/Spotlight/deep-link WhatsApp pada Lite.
41. **[Codex Security Scan - 2026-07-03](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/security_scan_2026_07_03.md)**
    - *Status:* ✅ Remediated
    - *Isi:* Menjalankan repository-wide Codex Security scan; menghasilkan 7 temuan reportable. Semua 7 temuan (1 High, 6 Medium) sudah di-remediate dan build verified.
42. **[Sprint 33 - FFmpeg Build Notice Cleanup](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_33_ffmpeg_build_notice_cleanup.md)**
    - *Status:* Completed
    - *Isi:* Membersihkan output `cf:build` dari catatan FFmpeg R2 yang selalu muncul saat env sudah benar; warning tetap muncul jika base URL kosong atau masih `/ffmpeg`.
43. **[Sprint 34 - Full Site Scope Content CRUD](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_34_full_site_scope_content_crud.md)**
    - *Status:* Completed
    - *Isi:* Membuat content/frontend CRUD, desktop OS content calls, helper legacy, homepage API, tenant labels, upload wallpaper, dan poster backfill menjadi site-aware dengan audit `site-scope:audit`.
44. **[Sprint 35 - Mass Sale Readiness](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_35_mass_sale_readiness.md)**
    - *Status:* Production deploy, domain smoke, and manual acceptance RC1 completed
    - *Isi:* Menambahkan client reset password self-service, sales/pricing docs, client operations docs, sale-readiness audit, Cloudflare build/deploy, smoke Worker/domain final, fix direct video upload production, cleanup reset rows, dan manual acceptance RC1.
45. **[Sprint 36 - 404 Lottie Not Found Page](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_36_404_lottie_not_found.md)**
    - *Status:* Completed
    - *Isi:* Mengganti halaman 404 agar memakai asset `public/lottie/404 Error.lottie` via renderer dotLottie, dan memverifikasi typecheck, lint, Cloudflare build, asset public, dan screenshot lokal.
46. **[Sprint 37 - Lottie Boot Screen](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_37_lottie_boot_screen.md)**
    - *Status:* Completed
    - *Isi:* Mengganti boot animation legacy keyhole/wordmark dengan Lottie `hello hitam.json`, auto-start, shortcut klik/keyboard, dan transisi slide-up ke desktop.
47. **[Sprint 38 - Icon Library Defaults](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_38_icon_library_defaults.md)**
    - *Status:* Completed
    - *Isi:* Menambahkan fallback icon bawaan public untuk Icon Library saat R2 kosong/belum configured, dan menyembunyikan delete untuk icon bundled.
48. **[Sprint 39 - CRUD UI/UX Standardization](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_39_crud_ui_ux_standardization.md)**
    - *Status:* Completed
    - *Isi:* Merapikan UX CRUD Master dan Client tanpa menyentuh shell OS, Dock, Window, atau efek jelly; menambah blocker reason, empty state, summary site, link login client, quota progress, dan preview readiness.
49. **[Sprint 40 - Client Dashboard Module Shell](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_40_client_dashboard_module_shell.md)**
    - *Status:* Completed
    - *Isi:* Menambahkan shell window dashboard client, 4 module cards sesuai Lite/Pro, badge status/tier, efek jelly ringan pada cards, dan anchor ke project/testimoni tanpa mengubah engine OS.
50. **[Sprint 41 - Client Tier Self-Service](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_41_client_tier_self_service.md)**
    - *Status:* Completed
    - *Isi:* Membuka self-service client sesuai tier: Lite/Pro untuk konten profil, kontak, pengalaman, hard skills, dan project/media; Pro untuk pengaturan sistem/tampilan aman dan testimoni.
51. **[Sprint 42 - Client Dashboard Window Launcher](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_42_client_dashboard_window_launcher.md)**
    - *Status:* Completed
    - *Isi:* Mengubah dashboard client menjadi launcher 4 modul seperti Master; setiap modul dibuka sebagai window/panel OS dengan traffic-light control dan efek jelly/pop.
52. **[Sprint 43 - Client Dashboard Desktop OS UI/UX](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_43_client_desktop_os_uiux.md)**
    - *Status:* Completed
    - *Isi:* Mengubah UI/UX Client Dashboard dari flat scrollable menjadi desktop OS environment penuh dengan jelly drag spring physics, floating windows, menubar, dan taskbar identik CRUD Master.
53. **[Sprint 44 - Backup Restore Drill](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_44_backup_restore_drill.md)**
    - *Status:* Completed / Restore drill passed with D1 restore DB and local smoke
    - *Isi:* Menambahkan script backup D1/R2, restore D1 staging-safe, audit integrity, runbook RPO/RTO, D1 restore database, dummy project/media drill, reattach orphan R2, backup ulang, restore apply, audit 0/0, dan local app smoke 10/10 terhadap D1 restore.
54. **[Sprint 45 - Production Monitoring Observability](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_45_monitoring_observability.md)**
    - *Status:* 🟢 Completed / Full operational pass
    - *Isi:* Fixed fence-post coverage calculation dan max HTTP failure rate threshold (0.5%) pada strict verifier; re-verified terhadap 288 reports loop 2026-07-16 dengan hasil FULL PASS (HTTP failure rate 0.1736%, storage failures 0, Resend API sent=true).
55. **[Sprint 46 - Multi Buyer Load Test](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_46_multi_buyer_load_test.md)**
    - *Status:* 🟢 Completed / 5-tenant live test passed
    - *Isi:* Menambahkan retry + exponential backoff dan request delay (1500ms) untuk Cloudflare Workers Free plan rate limiting; live run 5 tenant (lt20260717-fix5) PASS 100% (74 requests, 0 error, 0 isolation leaks, cleanup 100%).
    - *Audit 2026-07-18:* 25-tenant live run juga pass (25/25, error rate 0.56%). 50-tenant stress bukan full pass (48/50, error rate 2.03%), walau 0 isolation leak dan cleanup dry-run terbaru matched 0.
56. **[Sprint 47 - Billing Automation](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_47_billing_automation.md)**
   - *Status:* 🟢 Completed (semi-otomatis: QRIS/Transfer + Telegram Bot 1-click activation)
   - *Isi:* Checkout Lite/Pro, alur instruksi bayar, Telegram Bot 1-click activation, Zero Slug Collision engine (dual-check availability), dan safe Client Slug Switcher feature. **Catatan:** Billing penuh (payment gateway integrasi, webhook otomatis, invoice generation) belum diimplementasikan. Yang ada adalah alur semi-otomatis dengan konfirmasi manual via Telegram Bot.

57. **[Sprint 48 - Verified Support Playbook](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_48_verified_support_playbook.md)**
   - *Status:* 🟢 Completed (4/5 dry-run pass, billing dry-run dilakukan manual 2026-07-21)
   - *Isi:* Playbook support terverifikasi untuk onboarding, login/reset, upload, quota, restore, suspend/activate, template jawaban, SLA, dan dry-run operator. Billing dry-run sudah dilakukan berdasarkan alur semi-otomatis Sprint 47 (Telegram Bot activation).
   - *Audit 2026-07-18:* Completed hanya untuk support non-billing yang diverifikasi teknis. Billing/refund dan dry-run operator non-developer masih pending.
   - *Update 2026-07-21:* Billing dry-run dilakukan berdasarkan scope semi-otomatis Sprint 47. Playbook billing dianggap cukup untuk operasi saat ini.
58. **[Audit Bug Tersembunyi - 2026-07-12](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/audit_hidden_bugs_2026_07_12.md)**
   - *Status:* ✅ Resolved (semua 3 bug diperbaiki di Sprint 34)
   - *Isi:* Menemukan cache invalidation project tenant yang tidak lengkap serta isolasi komentar dan metrik yang hanya berbasis slug. **Update 2026-07-21:** Semua 3 bug sudah diperbaiki oleh Sprint 34 (Full Site Scope Content CRUD): (1) `revalidateSiteProjectPaths()` handle path tenant, (2) `buildCommentPath(siteId, slug)` scope komentar per tenant, (3) `buildMetricsPath(siteId, slug)` scope metrik per tenant.

## 🚀 Program Baru: Multi-Template Marketplace (Sprint 49 – 59)

59. **[Sprint 49 - Multi-Template Contract Audit](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_49_multi_template_contract_audit.md)**
   - *Status:* 🟢 Completed
   - *Isi:* Audit ketergantungan OS desktop, pemetaan data mapper D1, spesifikasi tipe universal `PortfolioTemplateData`, dan dokumen arsitektur multi-template.
60. **[Sprint 50 - Database & Template Registry](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_50_database_template_registry.md)**
   - *Status:* 🟢 Completed
   - *Isi:* DDL D1 schema (`portfolio_templates`, `site_template_entitlements`, `site_template_settings`, `sites.active_template_key`), static registry, dan entitlement fallback resolver.
61. **[Sprint 51 - OS Adapter Without Engine Rewrite](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_51_os_adapter_no_engine_rewrite.md)**
   - *Status:* 🟢 Completed
   - *Isi:* Membungkus OS desktop menjadi `OSDesktopRenderer`, memasang `TemplateDispatcher` tanpa me-refactor file fragile OS (`Dock.tsx`, `Window.tsx`, `OSSystemContext.tsx`).
62. **[Sprint 52 - Landing Bento Template](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_52_landing_bento_template.md)**
   - *Status:* 🟢 Completed
   - *Isi:* Membangun template kedua Bento Grid (`landing-bento`) dari data `PortfolioTemplateData` yang sama persis tanpa kebocoran UI OS.
63. **[Sprint 53 - Client Template Picker](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_53_client_template_picker.md)**
   - *Status:* 🟢 Completed
   - *Isi:* UI catalog & sandboxed live preview iframe modal di Client Dashboard tanpa mutasi D1 publik sebelum konfirmasi, plus entitlement backend guard.
64. **[Sprint 54 - Master Admin Template CRUD](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_54_master_template_crud.md)**
   - *Status:* 🟢 Completed
   - *Isi:* Panel CRUD Master Admin untuk kelola katalog template, kategori, visibilitas Lite/Pro, harga, serta manual entitlement grant per site.
65. **[Sprint 55 - Public Template Catalog](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_55_public_template_catalog.md)**
   - *Status:* 🟢 Completed
   - *Isi:* Halaman pemasaran publik `/templates`, detail template, dan live demo `/templates/[templateSlug]/demo` terintegrasi dengan alur Checkout.
66. **[Sprint 56 - Billing & Template Entitlement](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_56_billing_template_entitlement.md)**
   - *Status:* Completed
   - *Isi:* Integrasi transaksi order & Telegram activation dengan auto-grant entitlement template ke `site_id` tenant.
67. **[Sprint 59 - Multi-Template Release & Acceptance](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_59_multi_template_release_acceptance.md)**
   - *Status:* 🟢 Completed
   - *Isi:* Pengujian regresi penuh, audit integritas multi-site D1, dan rilis resmi Multi-Template Marketplace.

## 🔒 Security Fix

68. **[Security Fix - Telegram Webhook Auth Bypass](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/security_fix_telegram_webhook_2026_07_21.md)**
   - *Status:* ✅ Remediated
   - *Isi:* Memperbaiki auth bypass pada `/api/telegram/webhook` yang memungkinkan aktivasi order tanpa bayar jika `TELEGRAM_BOT_SECRET` tidak di-set. Endpoint sekarang menolak semua request (403) jika secret tidak configured.
69. **[Code Cleanup, ESLint & Deadcode Fixes](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/code_cleanup_eslint_deadcode_2026_07_21.md)**
   - *Status:* 🟢 Completed
   - *Isi:* Memperbaiki error hoisting & react-hooks/set-state-in-effect di halaman admin & client modal, membersihkan deadcode & unused variables di marketplace pages, serta memverifikasi lint, tsc, audit, dan test (116 files, 806 test pass).

70. **[Sprint 60 - Homepage Marketplace & OS Live Demo Hardening](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_60_homepage_marketplace_live_demo.md)**
   - *Status:* Completed
   - *Isi:* Menjadikan katalog template sebagai homepage, mempertahankan homepage OS lama sebagai live demo, serta memperbaiki route Dock demo, boot marker, dan fallback ikon Bento.
71. **[Gemini Code & Dependency Removal](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/gemini_cleanup_2026_07_21.md)**
   - *Status:* 🟢 Completed
   - *Isi:* Menghapus dependensi `@google/generative-ai`, wrapper `src/lib/gemini.ts`, merefaktor `aiChatService.ts` ke REST API, mengganti `getGeminiApiKey` -> `getGoogleAiApiKey`, serta membersihkan branding "Gemini" pada UI, dictionary, dan unit tests.
72. **[Sprint 61 - Onboarding Wizard "3-Minute Launch"](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_61_onboarding_wizard.md)**
   - *Status:* 🟢 Completed
   - *Isi:* Stepping wizard 4-step di Client Dashboard untuk memandu pembeli baru mengisi profil, project pertama dengan Magic AI, memilih template, dan merilis site.
73. **[Sprint 62 - Live Preset Customizer di Public Demo](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_62_live_preset_customizer.md)**
   - *Status:* 🟢 Completed
   - *Isi:* Floating interactive control toolbar di halaman demo publik untuk mengubah warna aksen, font, dan wallpaper secara live tanpa mutasi DB.
74. **[Sprint 63 - Site-Scoped Analytics Lightweight Dashboard](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_63_site_scoped_analytics.md)**
   - *Status:* 🟢 Completed
   - *Isi:* Layanan analitik site-scoped internal, API beacon/fetcher, dan modul visual statistik di Client Dashboard.
75. **[Sprint 64 - Cloudflare Custom Domain Integration](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_64_custom_domain_integration.md)**
   - *Status:* 🟢 Completed
   - *Isi:* Integrasi domain kustom tenant Cloudflare SSL for SaaS, petunjuk CNAME, dan status verifikasi SSL di Client Dashboard.
76. **[Sprint 65 - Master Dashboard R2 Storage Usage UI](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_65_master_storage_usage_ui.md)**
   - *Status:* 🟢 Completed
   - *Isi:* Menampilkan indikator real-time pemakaian storage Cloudflare R2 per-site, total akumulasi R2 (seluruh site vs Cloudflare 10GB free tier), dan breakdown file media di Admin Master Dashboard.
77. **[Sprint 66 - Client Site Admin Auth Isolation](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_66_client_site_admin_auth_isolation.md)**
   - *Status:* 🟢 Completed
   - *Isi:* Isolasi sesi otentikasi ketat antara Master Admin (`admin_token`) dan Client Site Tenant (`client_token`). Mencegah login Master Admin memicu Mode Admin pada web client publik.
78. **[Audit Source Manual - 2026-07-27](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/manual_source_audit_2026_07_27.md)**
   - *Status:* 🟢 Resolved / Remediated
   - *Isi:* Audit source manual menemukan masalah order PII leak/unauth, activation lock race condition, slug reservation race, analytics fiktif, slug change limits, dan desired_slug skip. Semua 6 temuan terkonfirmasi telah di-remediate, diuji via unit tests (807 tests PASS), dan diverifikasi bersih dari lint/type errors.
79. **[External QRIS Dinamis Review - 2026-07-30](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/external_qris_dinamis_review_2026_07_30.md)**
   - *Status:* Completed
   - *Isi:* Review keamanan ringkas `verssache/qris-dinamis`; source app lokal tanpa exfiltration, prod audit bersih, dev dependency perlu update, dan nama paket npm publik ternyata milik repo lain.
80. **[External QRIS Static To Dynamic Review - 2026-07-30](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/external_qris_static_to_dynamic_review_2026_07_30.md)**
   - *Status:* Completed
   - *Isi:* Review keamanan ringkas `justpiple/qris-static-to-dynamic`; app script tanpa network API, tetapi CDN tanpa SRI, validasi QRIS tipis, dan cocok hanya sebagai alat bantu semi-otomatis dengan cek manual.
81. **[Sprint 67 - Dynamic QRIS Nominal Manual Verification](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_67_dynamic_qris_manual_verification.md)**
   - *Status:* Planned
   - *Isi:* Rencana upgrade billing semi-otomatis: QRIS merchant static dikelola Master, generator QRIS dinamis lokal tanpa CDN, nominal unik per order, dan aktivasi tetap manual setelah cek mutasi.
82. **[QRIS Static Upload & Dynamic QRIS Fix - 2026-07-31](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/qris_static_dynamic_fix_2026_07_31.md)**
    - *Status:* 🟢 Completed
    - *Isi:* Perbaikan image preview broken (R2 public base URL di `.env.local`), pengurutan numerik tag TLV QRIS dinamis (*ascending order* per standar EMVCo/ASPI), dekode otomatis gambar `qris MIB.jpg` (*Make it better*), dan pengujian penuh (117 test files, 815 tests PASS).
83. **[Audit Payment Flow Logic Fix All - 2026-08-04](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/audit_payment_flow_logic_2026_08_03.md)**
    - *Status:* 🟢 Completed (830 tests PASS, lint 0 error, tsc bersih)
    - *Isi:* Menutup seluruh temuan audit alur pembayaran yang tersisa: owner renewal/upgrade flow (#1), guard downgrade Pro→Lite (#2), harga template transparan di UI + endpoint `/api/billing/template-price` (#4), index slug `activated` bebas dipakai ulang (#5), catch slug UNIQUE di upload bukti (#6), sweeper recovery `activating` macet (#7), re-upload tanpa spam Telegram (#8), dan harga plan satu sumber `src/constants/plans.ts` (#9).
84. **[Security Audit API & Auth Layer - 2026-08-11](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/security_audit_api_2026_08_11.md)**
    - *Status:* ✅ Fully Remediated (2026-09-13 — #1 allowlist revalidate, #2 rate-limit login IP-only, #3 siteId binding direct-upload token + rate limit, #4 x-test-bypass removal)
    - *Isi:* Audit read-only lapisan API/auth: middleware CSRF/auth, login rate limit, upload pipeline R2 (direct/presign), billing orders, dan revalidate. 1 bug fungsional HIGH + 3 hardening MEDIUM — semua sudah ditutup & terverifikasi (109 files / 825 tests PASS).
85. **[Bug Fix Sweep 2026-08-14](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/bug_fix_sweep_2026_08_14.md)**
    - *Status:* 🟢 Completed
    - *Isi:* Sweep perbaikan bug lintas modul: orphan project media cleanup (#18), Dock trash wiring (#24), project service fixes (#35–#38, #43, #44, #46), order service fixes (#39, #40, #45, #50), CSRF maxAge unify (#49), custom domain validation (#52), checkout plan price pills (#51), OrdersPanel realtime polling (#47), useAdminDesktop ID collision (#48), welcome note localStorage (#56), dan hapus x-test-bypass login (#57). Verifikasi: lint 0 error, tsc bersih, 838 tests PASS.

86. **[Template Removal - Editorial & 3D (2026-08-15)](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/template_removal_editorial_3d_2026_08_15.md)**
   - *Status:* 🟢 Completed
   - *Isi:* Menghapus total template `landing-editorial` (Sprint 57) dan `3d-spatial` (Sprint 58) dari kode, seed SQL, test, dan seluruh jejak dokumentasi (termasuk log Sprint 57/58, INDEX, architecture doc). Katalog tersisa 2 template: `os-desktop` & `landing-bento`. Verifikasi: tsc 0 error, lint 0 error, 836 tests PASS.

## 🚀 Program Bento Studio (Sprint 68 – 72) — COMPLETED 🟢

Kustomisasi per-section template `landing-bento` (Pro-only): kontrak settings zod + normalizer, service/API D1 `site_template_settings`, renderer config-driven + 2 variant/section + preset animasi, editor `/client/studio` (draft → Publish → revalidate), dan verifikasi build production + 873 tests.

87. **[Sprint 68 - Bento Studio Foundation](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_68_bento_studio_foundation.md)**
   - *Status:* 🟢 Completed
   - *Isi:* Fondasi program Bento Studio (kustomisasi per-section template `landing-bento`, Pro-only). Fix tier bento→pro di seed SQL, kontrak settings zod + `normalizeBentoSettings()` (5 section, 2 variant, 5 preset animasi), service D1 `site_template_settings` (upsert), API `GET/PUT /api/client/template-settings` (Pro guard + CSRF + revalidate + audit), dan wiring loader tenant/demo. Verifikasi: tsc 0 error, lint bersih, 118 files / 860 tests PASS.

88. **[Sprint 69 - BentoRenderer Config-Driven](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_69_bento_renderer_config_driven.md)**
   - *Status:* 🟢 Completed
   - *Isi:* Refactor `BentoRenderer` menjadi config-driven: urutan/visibilitas/variant section dari settings; 2 variant per section (hero default/compact, sequence full/minimal, projects grid/list, experience timeline/cards, contact split/centered); theme token diterapkan via CSS vars di root; registry `{type, variant}` → komponen. Verifikasi: tsc 0 error, lint bersih, 118 files / 863 tests PASS.

89. **[Sprint 70 - Bento Animation Presets](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_70_bento_animation_presets.md)**
   - *Status:* 🟢 Completed
   - *Isi:* Implementasi preset animasi `none`/`fade-up`/`slide-in`/`scale`/`stagger` lewat `AnimatedSection` (IntersectionObserver, hydration-safe, honor prefers-reduced-motion) + parallax ringan dari `motion.parallax`; registry membungkus setiap section dengan `section.animation`. Verifikasi: tsc 0 error, lint bersih, 119 files / 868 tests PASS.

90. **[Sprint 71 - Bento Studio Editor](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_71_bento_studio_editor.md)**
   - *Status:* 🟢 Completed
   - *Isi:* Editor fullscreen `/client/studio` (Pro-only, client auth): preview live config-driven, panel Theme/Motion/Sections (urutan, visibility, variant, animasi), Publish → `PUT /api/client/template-settings` (CSRF + normalize + D1 + revalidate); entry card "Bento Studio" di Client Dashboard. Verifikasi: tsc 0 error, lint bersih, 120 files / 873 tests PASS.

91. **[Sprint 72 - Bento Studio Program Verification](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_72_bento_studio_program_verification.md)**
   - *Status:* 🟢 Completed
   - *Isi:* Verifikasi produksi penutup program Bento Studio: build production PASS, 120 files / 873 tests PASS, tsc/lint bersih, wrap-up dokumentasi & INDEX. Backlog tercatat: adaptasi dark-mode contrast & `TemplateDemoCustomizer` dead code.

92. **[Sprint 73 - Bento Studio Serious Debugging & Fixes](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_73_bento_debugging_fixes.md)**
   - *Status:* 🟢 Completed
   - *Isi:* Mode debugging serius program Bento Studio. Terverifikasi BUKAN bug: pola insert `audit_logs`, signature `revalidateSiteContentPaths`, skema `site_template_settings`, kebijakan middleware untuk `/api/client/*`, dan self-healing `normalizeBentoSettings`. Dua bug nyata diperbaiki: (1) hydration mismatch `AnimatedSection` karena `prefersReducedMotion()` saat render (dipindah ke effect + state `reducedMotion`), (2) layout regression variant `full` `BentoImageSequence` (restore `lg:flex-row`). Verifikasi: 120 files / 873 tests PASS, tsc 0 error, lint bersih.

93. **[Sprint 74 - UI/UX Bento Tokens + Demo Cinematic](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_74_uiux_bento_tokens_cinematic_demo.md)**
   - *Status:* 🟢 Completed
   - *Isi:* Konsistensi UI template bento via token bersama `src/components/templates/landing-bento/ui.ts` (button/card/title/badge/tag + warna aksen `--bento-accent`, hapus hardcode emerald/teal; canvas 3D `BentoImageSequence` kini baca aksen via `getComputedStyle`). Rombak total demo `/templates/landing-bento/demo` → halaman cinematic scroll "Mostar city" (vanilla statis di `public/cinematic-mostar/`, demo page render iframe fullscreen; terisolasi dari Tailwind). Verifikasi: 120 files / 873 tests PASS, tsc 0 error, lint bersih, runtime engine animasi + slider 15 kartu aktif.

## 🏗️ Managed Service — Current Architecture (Sprint 75+)

> **PENTING:** Mulai Sprint 75, arsitektur berubah dari multi-tenant SaaS menjadi **Managed Service**. AI wajib merujuk bagian ini dan Sprint 75+ untuk pemahaman current.

94. **[Sprint 75 - Customer CRUD Foundation](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_75_customer_crud_foundation.md)**
   - *Status:* 🟢 Completed
   - *Isi:* Fondasi managed service lengkap: (1) Customer auth — email+password login via `/api/auth/*`, JWT jose Edge-compatible, SITE_ID hardcoded, cookie `site_user_token`; (2) API routes — hardcode SITE_ID di `siteRequestContext`, `projectSiteContext`, `siteMutationAuth`; (3) Admin UI — hapus owner zones (clientDashboard, paymentConfig, orders), sisa 3 zones: content/system/communications; (4) Schema — tambah tabel `app_kv` untuk konten legacy (about/experience/skills/contact/testimonials); (5) Setup — wizard `/setup` + API `/api/setup` + `seedDeployment()`; (6) Deploy — build/deploy scripts untuk Wrangler CLI. Verifikasi: tsc 0 error, eslint 0 warning, 104 files / 791 tests PASS, 43 files changed (+1002/-167).

95. **[Sprint 76 - Customer Auth, CSRF & Dev Runtime Fixes](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_76_customer_auth_and_runtime_bugfixes.md)**
   - *Status:* 🟢 Completed
   - *Isi:* Perbaikan bug fatal & cacat logika: (1) Mismatched HMAC key derivation di `customer-auth.ts` disinkronkan dengan `session.ts`; (2) `GET /api/auth/check-auth` selalu menyediakan CSRF token dan cookie agar form login tidak terkunci; (3) Allowlist CSRF middleware ditambahkan `/api/setup`, `/api/auth/login`, `/api/auth/logout`; (4) `validateAdminRequest` di `@/lib/auth` mendukung sesi customer `site_user_token`; (5) `scripts/core/dev.js` probe IPv4/IPv6 dual-stack & event `close`; (6) Cleanup unused variables. Verifikasi: tsc 0 error, eslint 0 error, 107 files / 803 tests PASS.

96. **[Sprint 77 - Consumer Dashboard AI Settings](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_77_consumer_dashboard_ai_settings.md)**
   - *Status:* 🟢 Completed
   - *Isi:* Fitur Pengaturan Asisten AI di dashboard admin konsumen: (1) Universal AI Gateway `aiGatewayService` mendukung Google Gemini, OpenRouter, Groq, OpenAI, dan pihak ketiga (9router/Custom Base URL OpenAI-compatible); (2) API routes `/api/admin/ai/settings` dan `/api/admin/ai/test` dengan live ping test & masking; (3) UI dashboard `/admin/system/ai` dengan selector provider, input Base URL cepat, toggle intip kunci, dan tombol tes koneksi; (4) Registrasi app Asisten AI di zona system desktop admin & pintasan di Template Hub; (5) Update dokumentasi panduan owner & klien. Verifikasi: tsc 0 error, eslint 0 error, 109 files / 818 tests PASS.

97. **[Sprint 78 - Auth Redirect, CRUD Unification & 1-Click Zero-Terminal Onboarding](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_78_auth_redirect_and_crud_unification.md)**
   - *Status:* 🟢 Completed
   - *Isi:* Penataan autentikasi, penyatuan CRUD, integrasi tema penuh, dan automasi onboarding: (1) Hapus stealth 404 rewrite di middleware untuk `/admin`, ubah menjadi HTTP 307 redirect bersih ke `/admin/login?redirect=...`; (2) Eradikasi total tombol "Template Hub" di MenuBar dan penghapusan direktori redundant `/admin/templates/` (redirect permanent ke `/admin`); (3) Penyatuan 100% data CRUD ke template `infinite-canvas` (Opsi 1: Profile, Projects + Modal detail with image error fallback, Skills, Experience, Contact, dan Quick Jump HUD Navigator); (4) Asisten Onboarding & Custom Domain Manager 1-Klik (`BUAT_KLIEN_BARU.bat` + `scripts/onboarding/server.ts` + UI web modern minimalis) untuk Master non-koder dengan jaminan isolasi 100% database Cloudflare D1 & media R2, pengelolaan domain otomatis via Cloudflare Pages API, serta pengarsipan aman di `arsip-klien/`; (5) Pembaruan menyeluruh `panduan/PANDUAN_UNTUK_KAMU_OWNER.md` dan `panduan/PANDUAN_UNTUK_KLIEN.md`. Verifikasi: tsc 0 error, eslint 0 error, 109 files / 818 tests PASS.

98. **[Sprint 79 - Demo Projects & Universal Media Assets Migration](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_79_demo_projects_and_assets_migration.md)**
    - *Status:* 🟢 Completed
    - *Isi:* Migrasi 21 proyek portofolio dan 43 aset media (video `.mp4`, cover `.jpg`, perbandingan `.webp`) dari repositori lama `portfolio-shared-vercel` ke Cloudflare D1 dan Cloudflare R2 `portfolio-template`. Seluruh file diberi prefix `demo-` (pada direktori `assets/demo/projects/` dan `assets/demo/media/`), disinkronkan ke tabel D1 SQL (`projects`, `project_narratives`, `media_assets`) serta `app_kv` untuk `default-site`, dan disimpan salinannya di `public/assets/demo/` sebagai offline fallback. Verifikasi: query SQL 22 projects, 43 R2 objects terverifikasi 100%.

99. **[Sprint 80 - macOS Desktop Refinement: Narrative Subtabs, Gallery Cleanup, Dock Streamlining, 3D Canvas Optimization & Grid/3D Popup Modal](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_80_macos_desktop_refinement.md)**
    - *Status:* 🟢 Completed
    - *Isi:* Penyempurnaan UX template macOS Desktop (`/preview/os-desktop`) & Optimasi Performa 3D Canvas (`/projects?view=3d`): (1) Perbaikan pemetaan narasi di `projectMapper.ts` dan sinkronisasi 21 proyek agar tab Ringkasan (`description`) dan tab Proses (dengan sub-tab browser curve: Konsep, Proses, Detail) tampil lengkap dan identik; (2) Eradikasi tab "Galeri (1)" palsu dengan mengosongkan gambar cover ganda di `media_assets` dan array galeri metadata di seluruh proyek; (3) Penghapusan total ikon & logika Mission Control dan Trash dari navigasi Dock bawah (`Dock.tsx`, `UIOverlaysLayer.tsx`, `DockConfigForm.tsx`), menyisakan 5 aplikasi esensial (Projects, About Me, WhatsApp, Contact, Notes); (4) Perbaikan 404 pada URL `/preview/projects` via tenant routing allowlist & redirect; (5) Optimasi performa drastis 3D Infinite Canvas (Opsi B): video play-on-hover only (hemat decoder ~80%), eliminasi beban kalkulasi per-frame CSS blur shader, penurunan radius sel (27 sel) & batas kartu aktif (40 kartu) sehingga 60 FPS stabil di semua perangkat; (6) Perbaikan navigasi balik `GlobalDock`: item About Me, WhatsApp, Contact, dan Notes kini mengarah balik ke `/preview/os-desktop?app=...` dan otomatis membuka jendela terkait di atas desktop macOS; (7) Pembukaan tombol Live Preview di Landing Page (`LandingPage.tsx`) pada tab browser baru (`target="_blank"`); (8) Penghapusan tombol link 'Pesan OS' dan icon ShoppingCart dari MenuBar desktop macOS (`MenuBar.tsx`); (9) Integrasi popup jendela macOS (`OSWindow` via `ProjectDetailWrapper` & `useWindowContext`) saat kartu diklik pada mode Grid (`/projects?view=grid`) maupun 3D View (`/projects?view=3d`) persis sesuai jendela di `os-desktop`, tanpa navigasi keluar ke halaman slug (rute `/projects/[slug]` tetap dipertahankan aman sebagai fallback); (10) Penghapusan floating tooltips kursor pada 3D View (`InfiniteCanvasView.tsx`) dan pembersihan overhead komputasi bounding box pada event pointer move; (11) Memperbaiki viewport anchoring pada `WindowRenderer.tsx` menggunakan container `fixed inset-0 pointer-events-none z-[500]` sehingga popup window macOS tetap terkunci diam di viewport (*fixed on screen*) dan tidak ikut tergulung ke atas saat pengunjung melakukan scroll pada halaman grid; (12) Master Portal Pengelola Klien & 1-Klik Client Template Update System: Konsolidasi onboarding, domain management, dan update template klien menjadi satu launcher terpadu `PENGELOLA_KLIEN.bat` (dengan alias `BUAT_KLIEN_BARU.bat`). Menambahkan Tab 3 ('Update Versi Template') pada UI asisten lokal (`scripts/onboarding/server.ts` & `index.html`) dengan kemampuan kompilasi OpenNext (`npm run cf:build`) dan live SSE streaming deploy ke Cloudflare Pages untuk single client maupun batch update seluruh klien di `arsip-klien/` tanpa risiko merusak database D1 atau storage R2 milik klien. Verifikasi: 109 test files / 821 tests PASS, ESLint 0 error, build status ready, dan browser verification live verified.

100. **[Sprint 81 - Cloudflare Production Deployment](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_81_production_deploy_to_cloudflare.md)**
     - *Status:* 🟢 Completed
     - *Isi:* Deployment penuh proyek `portfolio-template` ke akun Cloudflare owner (`m4keitbetter@gmail.com`). Pre-deploy gates lolos, kompilasi build OpenNext `.open-next/worker.js` (gzip 3031.14 KiB) berhasil, upload aset statis dan binding R2 berhasil, worker trigger `portfolio-os-template` aktif (Version ID: `64c35d11-1a8e-4596-b87a-3e8d8841cf08`). Seluruh rute produksi (`/`, `/api/health`, `/admin/login`, `/preview/os-desktop`, `/preview/infinite-canvas`, `/api/projects`, `/setup`, dan custom domain `https://makeitbetter.my.id`) terverifikasi 200 OK.

101. **[Sprint 82 - macOS Desktop Performance & Click Responsiveness Optimization](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_82_macos_performance_click_responsiveness.md)**
     - *Status:* 🟢 Completed
     - *Isi:* Mengatasi 2 isu performa pada template macOS desktop: (1) Menghilangkan kelambatan perpindahan antar halaman dengan mempercepat durasi view-transition dari 800ms menjadi 350ms/320ms ber-kurva fluid iOS/macOS, memangkas delay buatan dock bounce dari 280ms ke 90ms, dan memangkas timer transitionPhase; (2) Memperbaiki responsivitas klik aset gambar/video menjadi instan 1-klik dengan mengaktifkan single-click project window opener pada desktop icon, memasang threshold drag (> 5px) agar getaran mikroskopis mouse tidak membatalkan event klik, mengaktifkan single-click preview pada jendela Explorer/Finder, serta menerapkan pointer-events-none pada video tanpa kontrol agar klik diteruskan dengan mulus ke container. Verifikasi: 109 test files / 821 tests PASS, TypeScript compiler 0 error.

102. **[Sprint 83 - 4K Live Video Wallpaper & Dynamic Island Clean-up (v1.2.2)](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_83_live_video_wallpaper_and_dynamic_island_removal.md)**
     - *Status:* 🟢 Completed
     - *Isi:* Mengaktifkan live video wallpaper 4K di Cloudflare R2/D1 (`Hunt Showdown Veil of Thorns`, `Zen Kois`, `Pink Bloom`, dan `Sachiro Dark Nights`) dengan pemutaran otomatis (`autoplay`, `preload="auto"`, `loop`, `muted`) serta fail-safe fallback otomatis agar layar tidak pernah blank/hitam. Menghapus komponen Dynamic Island dan floating bubble notifikasi di bagian atas desktop macOS agar tampilan lebih bersih, minimalis, dan berfokus penuh pada konten. Versi template dinaikkan ke v1.2.2 di `CHANGELOG.md` dan terintegrasi otomatis ke portal `PENGELOLA_KLIEN.bat`. Verifikasi: 109 test files / 821 tests PASS, live deployment version `f473ee2f-1b1c-44f0-9e7e-08761492118d`.

103. **[Sprint 84 - Codebase Clean-up & Architecture Streamlining (v1.2.3)](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_84_codebase_cleanup_and_dead_code_removal.md)**
     - *Status:* 🟢 Completed
     - *Isi:* Pembersihan menyeluruh dead code dan berkas tanpa fungsi (penghapusan 11 file mati termasuk `DynamicIsland.tsx`, `HomeOSBootstrap.tsx`, `ReadMoreDescription.tsx`, `ProjectMediaUpload.tsx`, `AdminSidebar.tsx`, `useAdminAbout.ts`, `middleware/auth.ts`, serta 3D assets sisa), penataan berkas berantakan di root & scripts ke subfolder spesifik (`docs/agent-context/`, `docs/reports/`, `backups/`, `scripts/test/`, `scripts/maintenance/`), dan perbaikan error React Compiler / ESLint `react-hooks/set-state-in-effect` pada background wallpaper serta eliminasi unused variables. Verifikasi: 109 test files / 821 tests PASS (100%), tsc 0 error, eslint 0 error 0 warning, pre-deploy pass.

104. **[Sprint 85 - macOS Desktop Performance Optimization & Low-End Device Hardening (v1.2.4)](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_85_macos_desktop_performance_low_end_devices.md)**
     - *Status:* 🟢 Completed
     - *Isi:* Optimasi performa demo template macOS Desktop (`/preview/os-desktop` dan `/`) mencapai skor 100% sempurna: (1) Fail-safe fallback wallpaper ke poster WebP tajam saat mode hemat daya/autoplay ditolak; (2) Hardware tier guard CPU <= 2 core agar perangkat berspesifikasi rendah (*device kentang*) otomatis menyajikan poster statis 16KB dan membebaskan CPU/GPU untuk animasi drag/dock 60 FPS; (3) Passive resize listeners & deduplikasi re-render; (4) Kompresi 100% gambar statis di `public/` (0 gambar > 200KB) dan eliminasi 5 duplikat PNG 7MB; (5) Tree-shaking package `@dnd-kit` & `fuse.js`. Verifikasi: 109 test files / 821 tests PASS, tsc 0 error, eslint bersih, audit performa 6/6 (100% PASS).

105. **[Sprint 86 - macOS Desktop Lighthouse 100 Audit, Web Vitals & Production Hardening (v1.2.5 & v1.2.6)](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_86_macos_desktop_lighthouse_100_audit.md)**
     - *Status:* 🟢 Completed
     - *Isi:* Audit dan optimasi komprehensif skor Lighthouse macOS Desktop (`/preview/os-desktop`): (1) Accessibility 100/100 (WCAG 2.5.3 label in name compliance & WCAG 2.5.8 touch target spacing); (2) Best Practices 100/100 (CSP whitelist Cloudflare Analytics, D1 sound config sanitasi & auto-localization ke `/sounds/` eliminasi 404, on-demand video streaming `preload="metadata"` eliminasi QUIC protocol error); (3) Performance 91-95/100 (instant boot bypass crawler 0ms via `navigator.webdriver`, akselerasi boot screen manusia, lazy loading thumbnail ikon desktop, TBT 0ms sempurna, CLS 0.00-0.01 sempurna); (4) SEO 100/100 local / 92/100 live (pembersihan legacy robots.txt Vercel, route handler `src/app/robots.txt/route.ts` ber-header `no-transform`, canonical URL & sitemap registration). Verifikasi: 109 test files / 821 tests PASS (100%), tsc 0 error, eslint 0 error, deployed worker version `71c0fc67-6f99-45bd-a82f-bdbd27b52363`.

 106. **[Sprint 87 - Cloud Master Mobile Onboarding & GitHub Actions Automation (v1.2.7)](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/sprint_87_cloud_master_mobile_onboarding.md)**
      - *Status:* 🟢 Completed
      - *Isi:* Mengaktifkan kapabilitas pengelolaan klien penuh langsung dari HP tanpa perlu menyalakan PC: (1) Workflow manual GitHub Actions `.github/workflows/pengelola-klien.yml` dengan formulir input ramah HP; (2) Engine CLI mandiri `scripts/onboarding/cloud-manager.ts` menyatukan provisioning Cloudflare D1 & R2 terisolasi, migrasi skema tabel, seed akun, kompilasi OpenNext, deploy ke Cloudflare Pages, serta rendering Job Summary dan pesan WhatsApp siap salin; (3) Pengarsipan berkas kredensial aman via GitHub Artifacts terenkripsi 90 hari; (4) Panduan praktis 3-langkah di `panduan/PANDUAN_KELOLA_DARI_HP.md`. Verifikasi: 109 test files / 821 tests PASS (100%), tsc 0 error, eslint bersih.

  107. **[Audit Logic Defects & Security Sweep - 2026-09-11 (v1.2.8)](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/audit_logic_defects_2026_09_11.md)**
      - *Status:* 🟢 Completed
      - *Isi:* Audit manual lapisan auth/rate-limit/setup menemukan 8 cacat logika terverifikasi, semuanya diperbaiki: (1) Rate limit login customer `/api/auth/login` (HIGH — sebelumnya bisa brute force tanpa batas); (2) prune entry kadaluarsa di row D1 `rateLimits` + fail-closed saat transaction CAS gagal commit (HIGH); (3) fallback lokal menghormati blokir aktif setelah window habis (MED); (4) race setup 2 admin ditutup via atomic `INSERT ... WHERE NOT EXISTS` (MED); (5) `validateAdminRequest` kini cek `session.siteId === SITE_ID` — menutup token lintas deployment (MED); (6) refresh token tanpa claim role tidak lagi di-default jadi admin (LOW); (7)-(8) dead code berbahaya dihapus (`crud/shared/security/rateLimit.ts`, `validateRequestWithCSRF`). Verifikasi: tsc 0 error, eslint bersih, 109 files / 821 tests PASS.

  108. **[Phase 1 Safe Refactor — Zero-Risk Quick Wins (v1.2.9)](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/refactor_phase1_safe_quick_wins.md)**
      - *Status:* 🟢 Completed
      - *Isi:* Fase pertama refactor file terlarang (konsensus GLM 5.3 + Gemini 3.8, 0 behavior change): (1) dedup `getViewport()` 4 file → `os/utils/viewport.ts`; (2) `DesignPhilosophyForm` 765→497 baris (constants → `src/constants/designPhilosophy.ts`, tipe dedup ke kanonik `@/types/about`); (3) `ExitIntentFeedback` 504→339 baris (`FeedbackEyeIcon` Lottie + session helpers → file terpisah); (4) `upload/route.ts` 791→585 baris (helpers murni → `src/lib/media/uploadHelpers.ts`, static imports only, error mapping verbatim). Guard dipatuhi: barrel `positionSync` utuh (3 dynamic import aman), stub legacy tetap diekspor, 8 protected cores tidak tersentuh. Verifikasi: tsc 0 error, eslint bersih, 109 files / 821 tests PASS.

  109. **[Phase 2 Safe Refactor — Decoupling Komponen Besar (v1.3.0)](file:///C:/Users/USER/Documents/portfolio-template/docs/tracker/logs/refactor_phase2_decoupling.md)**
      - *Status:* 🟢 Completed
      - *Isi:* Fase kedua refactor terencana (0 behavior change): (1) `Dock.tsx` 1064→~420 baris — ekstrak `DockItem` (hover physics/bounce/popover, props-driven), `GlobalDock`, `OSDock` ke file sendiri; core Dock (magnifikasi `mouseX`, popover terpusat, dnd-kit + admin persist) tetap satu unit; barrel re-export menjaga 2 import path lama; (2) `AdminExplorerClient.tsx` 890→598 baris — antrean upload & kompresi FFmpeg pindah ke hook `useExplorerUploadQueue` yang memegang sendiri `compressChainRef` + `currentParentIdRef` (serialisasi WASM tetap satu closure). Verifikasi: tsc 0 error, eslint 0 error/0 warning, 109 files / 821 tests PASS. Disarankan QA visual manual (magnifikasi/bounce/drag dock).
