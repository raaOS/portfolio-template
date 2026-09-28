import { describe, it, expect } from 'vitest';
import { extractStoragePath } from '../urlResolver';

describe('extractStoragePath', () => {
  it('mengembalikan object key R2 dari path /r2/', () => {
    expect(extractStoragePath('/r2/assets/wallpapers/foo.jpg')).toBe(
      'assets/wallpapers/foo.jpg'
    );
    expect(extractStoragePath('r2/temp/bar.mp4')).toBe('temp/bar.mp4');
  });

  it('membuang query string cache-buster (?v=2) sehingga key tetap valid', () => {
    expect(extractStoragePath('/r2/assets/wallpapers/foo.jpg?v=2')).toBe(
      'assets/wallpapers/foo.jpg'
    );
    expect(extractStoragePath('/r2/assets/wallpapers/foo.jpg?v=2&x=1')).toBe(
      'assets/wallpapers/foo.jpg'
    );
  });

  it('membuang fragment', () => {
    expect(extractStoragePath('/r2/assets/wallpapers/foo.jpg#t=14')).toBe(
      'assets/wallpapers/foo.jpg'
    );
  });

  it('menangani URL absolut termasuk query-nya', () => {
    expect(extractStoragePath('https://pub-abc.r2.dev/assets/wallpapers/foo.jpg?v=2')).toBe(
      'assets/wallpapers/foo.jpg'
    );
  });

  it('mengembalikan null untuk input kosong atau path tak dikenal', () => {
    expect(extractStoragePath('')).toBeNull();
    expect(extractStoragePath('?v=2')).toBeNull();
    expect(extractStoragePath('/media/foo.jpg')).toBeNull();
  });
});
