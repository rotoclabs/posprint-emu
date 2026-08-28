import iconv from 'iconv-lite';

/** MVP supports a single fixed codepage; ESC t (select codepage) is a future extension point. */
export function decodeText(bytes: Buffer): string {
  return iconv.decode(bytes, 'cp437');
}
