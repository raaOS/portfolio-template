import { NextResponse } from 'next/server';

/**
 * Empty response endpoint - used to swallow HMR polling requests.
 */

const noContent = () => new NextResponse(null, { status: 204 });

export async function GET() {
  return noContent();
}
export async function POST() {
  return noContent();
}
export async function HEAD() {
  return noContent();
}
