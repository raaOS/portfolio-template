export interface QRISTlv {
  tag: string;
  value: string;
}

export interface QRISValidationResult {
  valid: boolean;
  errors: string[];
}

export function calculateQRISCRC16(input: string): string {
  let crc = 0xffff;
  for (let index = 0; index < input.length; index += 1) {
    crc ^= input.charCodeAt(index) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
    }
  }
  return (crc & 0xffff).toString(16).toUpperCase().padStart(4, '0');
}

export function normalizeQRISPayload(payload: string): string {
  return payload.replace(/[\r\n\t]/g, '').trim();
}

export function parseQRISTlv(payload: string): QRISTlv[] {
  const normalized = normalizeQRISPayload(payload);
  const elements: QRISTlv[] = [];
  let cursor = 0;

  while (cursor < normalized.length) {
    if (cursor + 4 > normalized.length) {
      throw new Error('QRIS payload terpotong');
    }

    const tag = normalized.slice(cursor, cursor + 2);
    const lengthText = normalized.slice(cursor + 2, cursor + 4);
    if (!/^\d{2}$/.test(tag) || !/^\d{2}$/.test(lengthText)) {
      throw new Error('Format TLV QRIS tidak valid');
    }

    const length = Number(lengthText);
    const valueStart = cursor + 4;
    const valueEnd = valueStart + length;
    if (valueEnd > normalized.length) {
      throw new Error('Panjang TLV QRIS tidak sesuai');
    }

    elements.push({ tag, value: normalized.slice(valueStart, valueEnd) });
    cursor = valueEnd;
  }

  return elements;
}

function getTag(elements: QRISTlv[], tag: string): string | undefined {
  return elements.find((element) => element.tag === tag)?.value;
}

function buildQRISTlv(elements: QRISTlv[]): string {
  return elements
    .map((element) => `${element.tag}${element.value.length.toString().padStart(2, '0')}${element.value}`)
    .join('');
}

function validateNestedMerchantInfo(elements: QRISTlv[], errors: string[]) {
  const merchantInfo = elements.find((element) => {
    const tagNumber = Number(element.tag);
    return tagNumber >= 26 && tagNumber <= 51;
  });

  if (!merchantInfo) {
    errors.push('QRIS tidak memiliki Merchant Account Information');
    return;
  }

  try {
    parseQRISTlv(merchantInfo.value);
  } catch {
    errors.push('Merchant Account Information QRIS tidak valid');
  }
}

export function validateStaticMerchantQRIS(payload: string): QRISValidationResult {
  const errors: string[] = [];
  const normalized = normalizeQRISPayload(payload);

  if (!normalized) {
    return { valid: false, errors: ['Payload QRIS wajib diisi'] };
  }

  if (!normalized.startsWith('000201')) {
    errors.push('QRIS harus diawali Payload Format Indicator 000201');
  }

  if (!/6304[0-9A-Fa-f]{4}$/.test(normalized)) {
    errors.push('QRIS wajib memiliki CRC tag 6304 di akhir payload');
  } else {
    const crcInput = normalized.slice(0, -4);
    const declared = normalized.slice(-4).toUpperCase();
    const expected = calculateQRISCRC16(crcInput);
    if (declared !== expected) {
      errors.push(`CRC QRIS tidak valid: expected ${expected}, got ${declared}`);
    }
  }

  let elements: QRISTlv[] = [];
  try {
    elements = parseQRISTlv(normalized);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Format QRIS tidak valid');
  }

  if (elements.length > 0) {
    if (getTag(elements, '01') !== '11') {
      errors.push('QRIS merchant harus static (Point of Initiation 11)');
    }
    if (getTag(elements, '53') !== '360') {
      errors.push('QRIS merchant harus memakai currency IDR (360)');
    }
    if (getTag(elements, '58') !== 'ID') {
      errors.push('QRIS merchant harus country code ID');
    }
    validateNestedMerchantInfo(elements, errors);
  }

  return { valid: errors.length === 0, errors };
}

export function convertStaticQRISToDynamic(payload: string, amount: number): string {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error('Nominal QRIS harus bilangan bulat positif');
  }

  const normalized = normalizeQRISPayload(payload);
  const validation = validateStaticMerchantQRIS(normalized);
  if (!validation.valid) {
    throw new Error(validation.errors.join('; '));
  }

  const source = parseQRISTlv(normalized).filter((element) => !['54', '55', '56', '57', '63'].includes(element.tag));
  const result: QRISTlv[] = [];
  let amountInserted = false;

  for (const element of source) {
    if (element.tag === '01') {
      result.push({ tag: '01', value: '12' });
      continue;
    }

    if (element.tag === '58' && !amountInserted) {
      result.push({ tag: '54', value: String(amount) });
      amountInserted = true;
    }

    result.push(element);
  }

  if (!amountInserted) {
    throw new Error('QRIS tidak memiliki Country Code tag 58 sebagai anchor nominal');
  }

  // Ensure TLVs are sorted numerically by Tag ID per EMVCo & ASPI QRIS specifications
  result.sort((a, b) => Number(a.tag) - Number(b.tag));

  const withoutCrc = buildQRISTlv(result);
  const crcInput = `${withoutCrc}6304`;
  return `${crcInput}${calculateQRISCRC16(crcInput)}`;
}

export function maskQRISPayload(payload: string): string {
  const normalized = normalizeQRISPayload(payload);
  if (normalized.length <= 24) return normalized ? 'configured' : '';
  return `${normalized.slice(0, 12)}...${normalized.slice(-8)}`;
}
