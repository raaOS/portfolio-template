export const dynamic = 'force-dynamic';
// Streaming wallpaper 50 MB di koneksi visitor 10 Mbps butuh ~40s.
// Default Hobby maxDuration 10s akan cut stream di tengah jalan,
// menyebabkan video corrupt / poster fallback. Set explicit 60s
// (max ceiling Hobby tier).
//
// Kalau cache HIT di CDN edge, function tidak invoke jadi
// limit ini tidak relevan untuk warm request. Limit hanya melindungi
// cold-cache request yang relatively rare (1× per region per asset).
export const maxDuration = 60;

export { GET, HEAD, OPTIONS } from '@/app/api/r2/[...key]/route';
