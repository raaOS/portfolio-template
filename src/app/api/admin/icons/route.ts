import { NextRequest, NextResponse } from 'next/server';
import { validateAdminRequest } from '@/lib/auth';
import { deleteIconSchema } from '@/lib/validations';
import { validationError } from '@/lib/api-response';
import {
  buildR2PublicUrl,
  deleteFromR2,
  isR2StorageConfigured,
  listR2ObjectKeys,
} from '@/lib/r2Storage';
import { extractStoragePath } from '@/lib/urlResolver';

const FOLDER_PATH = 'assets/icons-library';
const LOCAL_DEFAULT_ICONS = [
  '1771773099304-ayvjblj21goq-icnsfile-d8f361ddd357476fc58d4f437de52ff4-adobecreativecloud--tahoe-default-.webp',
  '1771772795413-93q5glpk8hei-icnsfile-dd452b95f80869039da006a431cb9cc8-contacts--ios-18-dark-.webp',
  '1769438534391-8jzxtsb8p9mp-icnsfile-ca52dc8679e2709366550576131c5747-bob.webp',
  '1769438534384-c2qoxrffhwv2-icnsfile-bd87257a063e75f0f7d799a64ab43302-whatsapp-business.webp',
  '1769438534379-ei47dwdwdyd2-icnsfile-a7181b3ed7f1a02b7f9256db3147a2d1-nano-banana--google-gemini-2.5-flash--yellow-banana--fruit--food--liquid-glass-.webp',
  '1769438534274-y84juvevsgx2-icnsfile-44662d2fce53144bec4612af170242c3-photos.webp',
  '1769438534250-fq8kofp6ihfy-icnsfile-4ec6cb84cd46ec05462df321c07583a4-6cjat8gosq.webp',
  '1769438534228-eun38oh6xtba-icnsfile-1dcc3c13dd2ba1a7d50f09dc8ee73ee4-folder---uppercut.webp',
  '1769438534213-hryi2syxn2eq-icnsfile-1543ba06906d6ac6721964ac3bfcc511-pearcleaner-alt-big-sur-5.webp',
  '1769437234492-st4egtv1o8tm-icnsfile-922467ee2be0869b8e2164714aed0616-notes.webp',
  '1769437234442-9g34vsipzwzj-icnsfile-0b7ca518d18f6e20ce3fe6a9a8979397-thug-life-finder.webp',
  '1769436776686-46a6lp8whemr-icnsfile-d7ac3a93471d5eaa0d43e730035de6eb-finder-beta-1-pink.webp',
  '1769436122525-019w5pst1ugd-icnsfile-9a9794114b8e46d4e5061a0ca9f119c0-launchpad.webp',
  '1769436122426-2rniwpr6xlqd-icnsfile-9ea7fee60ee0da380e761089e7589b73-1tcifnge2a.webp',
].map((fileName) => `/${FOLDER_PATH}/${fileName}`);

export async function GET(req: NextRequest) {
  try {
    if (!(await validateAdminRequest(req, { checkCsrf: false }))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isR2StorageConfigured()) {
      return NextResponse.json({ icons: LOCAL_DEFAULT_ICONS });
    }

    const r2Icons = (await listR2ObjectKeys({ prefix: FOLDER_PATH }))
      .filter(isIconKey)
      .sort((a, b) => b.localeCompare(a))
      .map((key) => buildR2PublicUrl(key));
    const icons = Array.from(new Set([...r2Icons, ...LOCAL_DEFAULT_ICONS]));

    return NextResponse.json({ icons });
  } catch (error) {
    console.error('[IconsAPI] GET Error:', error);
    return NextResponse.json({ error: 'Failed to list icons' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    if (!(await validateAdminRequest(req))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const iconUrl = searchParams.get('url');

    const validation = deleteIconSchema.safeParse({ url: iconUrl });
    if (!validation.success) {
      return validationError(validation.error);
    }

    const { url } = validation.data;

    const storagePath = extractStoragePath(url);
    if (!storagePath) {
      return NextResponse.json({ error: 'Invalid icon path/URL structure' }, { status: 400 });
    }

    const dirName = storagePath.split('/').slice(0, -1).join('/'); // assets/icons-library
    const fileName = storagePath.split('/').pop() || '';
    const ext = fileName.includes('.') ? fileName.substring(fileName.lastIndexOf('.')) : '';
    const baseName = ext ? fileName.substring(0, fileName.length - ext.length) : fileName;

    // Variants to delete
    const extensions = ['.icns', '.webp', '.png', '.jpg', '.jpeg', '.svg'];
    const suffixes = ['', '_temp'];

    // Collect all potential targets
    const targetsToDelete: string[] = [];
    for (const suffix of suffixes) {
      for (const variantExt of extensions) {
        targetsToDelete.push(`${dirName}/${baseName}${suffix}${variantExt}`);
      }
    }

    await Promise.all(
      targetsToDelete.map(async (targetPath) => {
        try {
          await deleteR2IconIfConfigured(targetPath);
          console.log(`[IconsAPI] Delete requested: ${targetPath}`);
        } catch (err) {
          console.warn(`[IconsAPI] Failed to delete ${targetPath}:`, err);
        }
      })
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[IconsAPI] DELETE Error:', error);
    return NextResponse.json({ error: 'Failed to delete icon' }, { status: 500 });
  }
}

function isIconKey(key: string) {
  if (key.includes('/.')) return false;
  if (key.includes('_temp')) return false;
  return /\.(webp|png|jpg|jpeg|svg)$/i.test(key);
}

async function deleteR2IconIfConfigured(targetPath: string) {
  if (!isR2StorageConfigured()) return;
  await deleteFromR2(targetPath);
}
