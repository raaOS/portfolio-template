import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const headers = request.headers;
    const signature = headers.get('x-hub-signature-256');
    const secret = process.env.REVALIDATION_TOKEN;

    if (!secret) {
      return NextResponse.json({ message: 'Secret not configured' }, { status: 500 });
    }

    if (!signature) {
      return NextResponse.json({ message: 'No signature' }, { status: 401 });
    }

    // Verify Signature
    const bodyBuffer = Buffer.from(rawBody, 'utf-8');
    const hmac = crypto.createHmac('sha256', secret);
    const digest = 'sha256=' + hmac.update(bodyBuffer).digest('hex');

    // Use timingSafeEqual to prevent timing attacks
    const signatureBuffer = Buffer.from(signature);
    const digestBuffer = Buffer.from(digest);

    if (
      signatureBuffer.length !== digestBuffer.length ||
      !crypto.timingSafeEqual(signatureBuffer, digestBuffer)
    ) {
      return NextResponse.json({ message: 'Invalid signature' }, { status: 401 });
    }

    // Process Payload
    const _payload = JSON.parse(rawBody);

    // We only care about pushes to main/master that touch data
    // But for simplicity, we revalidate on any push for now.

    // Revalidate paths
    revalidatePath('/');
    revalidatePath('/about');
    revalidatePath('/contact');
    // Preview demo: halaman ISR (revalidate = 60) yang tidak pernah masuk daftar
    // mana pun, jadi webhook push tidak pernah menyegarkan render demo.
    revalidatePath('/preview/os-desktop');
    revalidatePath('/preview/infinite-canvas');
    revalidatePath('/preview/spatial-gallery');

    console.log('[Revalidate] Webhook received & revalidated all paths');

    return NextResponse.json({ revalidated: true, now: Date.now() });
  } catch (err) {
    console.error('[Revalidate] Error:', err instanceof Error ? err.message : err);
    return NextResponse.json({ message: 'Error revalidating' }, { status: 500 });
  }
}
