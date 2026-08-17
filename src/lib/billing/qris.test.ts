import { describe, expect, it } from 'vitest';
import {
  calculateQRISCRC16,
  convertStaticQRISToDynamic,
  normalizeQRISPayload,
  parseQRISTlv,
  validateStaticMerchantQRIS,
} from './qris';

function withCRC(payloadWithoutCRC: string) {
  const crcInput = `${payloadWithoutCRC}6304`;
  return `${crcInput}${calculateQRISCRC16(crcInput)}`;
}

const STATIC_QRIS = withCRC('00020101021126470014ID.CO.QRIS.WWW01189360091100212345670203UMI5204581253033605802ID5908TOKOCEK16007JAKARTA');
const STATIC_QRIS_WITH_SPACES = withCRC('00020101021126470014ID.CO.QRIS.WWW01189360091100212345670203UMI5204581253033605802ID5908TOKO CEK6007JAKARTA');

describe('qris billing utility', () => {
  it('validates a static IDR merchant QRIS payload', () => {
    expect(validateStaticMerchantQRIS(STATIC_QRIS)).toEqual({ valid: true, errors: [] });
  });

  it('preserves spaces inside QRIS values while removing pasted line breaks', () => {
    expect(normalizeQRISPayload(`\n${STATIC_QRIS_WITH_SPACES}\r\n`)).toBe(STATIC_QRIS_WITH_SPACES);
    expect(validateStaticMerchantQRIS(STATIC_QRIS_WITH_SPACES)).toEqual({ valid: true, errors: [] });
  });

  it('rejects invalid CRC', () => {
    const result = validateStaticMerchantQRIS(`${STATIC_QRIS.slice(0, -4)}FFFF`);
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('CRC QRIS tidak valid');
  });

  it('rejects QRIS that is already dynamic', () => {
    const dynamicSource = withCRC(STATIC_QRIS.slice(0, -8).replace('010211', '010212'));
    const result = validateStaticMerchantQRIS(dynamicSource);
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('harus static');
  });

  it('converts static QRIS to dynamic with amount tag and fresh CRC', () => {
    const dynamic = convertStaticQRISToDynamic(STATIC_QRIS, 99123);
    const tags = parseQRISTlv(dynamic);

    expect(tags.find((tag) => tag.tag === '01')?.value).toBe('12');
    expect(tags.find((tag) => tag.tag === '54')?.value).toBe('99123');
    expect(validateStaticMerchantQRIS(dynamic).valid).toBe(false);

    const crcInput = dynamic.slice(0, -4);
    expect(dynamic.slice(-4)).toBe(calculateQRISCRC16(crcInput));

    // Verify strictly ascending tag ID order per EMVCo/ASPI standard
    const tagNumbers = tags.map((t) => Number(t.tag));
    for (let i = 0; i < tagNumbers.length - 1; i++) {
      expect(tagNumbers[i]).toBeLessThan(tagNumbers[i + 1]);
    }
  });
});
