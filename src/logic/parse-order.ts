// Turns the text read from a photographed order form into mission fields.
// Rules only: detect the insurer by name, then read each "Label: value" line.
// OCR mistakes are expected, so labels are matched loosely and digits are
// repaired (O -> 0, l/I -> 1) only inside fields that must be numbers.
import type { Insurer, Service } from '../model/types.ts';
import { normKey } from './util.ts';

export interface ParsedOrder {
  insurer: string | null;
  fileRef: string | null;
  orderNo: string | null;
  incidentDate: string | null;
  insuredName: string | null;
  phone: string | null;
  vehicleModel: string | null;
  vehiclePlate: string | null;
  event: string | null;
  pickup: string | null;
  destination: string | null;
  serviceCode: string | null;
  distanceKm: number | null;
  roundTrip: number;
}

const LABELS: [keyof ParsedOrder, RegExp][] = [
  ['fileRef', /^\s*file\s*re[fr]\w*\s*[:;.]?\s*(.+)$/im],
  ['orderNo', /^\s*order\s*n[o0°]\.?\s*[:;.]?\s*(.+)$/im],
  ['incidentDate', /^\s*(?:incident\s*)?date\s*[:;.]?\s*(.+)$/im],
  ['insuredName', /^\s*insured\s*[:;.]?\s*(.+)$/im],
  ['phone', /^\s*phone\s*[:;.]?\s*(.+)$/im],
  ['vehicleModel', /^\s*vehicle\s*[:;.]?\s*(.+)$/im],
  ['vehiclePlate', /^\s*plate\s*[:;.]?\s*(.+)$/im],
  ['event', /^\s*event\s*[:;.]?\s*(.+)$/im],
  ['pickup', /^\s*pick\s*-?\s*up\s*[:;.]?\s*(.+)$/im],
  ['destination', /^\s*destination\s*[:;.]?\s*(.+)$/im],
];

const fixDigits = (s: string): string => s.replace(/[Oo]/g, '0').replace(/[lI|]/g, '1').replace(/[Ss](?=\d)/g, '5');

/** File refs start with the insurer's letters ("CO-26-31877"): OCR reading "C0" gets its letters back. */
export const fixFileRef = (s: string): string =>
  s.replace(/\s+/g, '').replace(/^[A-Z0-9]{2}(?=-)/i, (p) => p.toUpperCase().replace(/0/g, 'O').replace(/1/g, 'I').replace(/5/g, 'S'));

/** "2026-09-21", "21/09/2026" or "21.09.2026" -> "2026-09-21". */
export function parseDate(raw: string): string | null {
  const s = fixDigits(raw).replace(/\s+/g, '');
  let m = s.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return `${m[1]}-${m[2]!.padStart(2, '0')}-${m[3]!.padStart(2, '0')}`;
  m = s.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (m) return `${m[3]}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}`;
  return null;
}

/** The insurer whose name appears in the text, the longest match winning. */
export function detectInsurer(text: string, insurers: readonly Insurer[]): string | null {
  const t = normKey(text);
  const hits = insurers.filter((i) => t.includes(normKey(i.name)));
  if (hits.length) return hits.sort((a, b) => b.name.length - a.name.length)[0]!.id;
  // OCR may break the name: fall back to its first distinctive word.
  const loose = insurers.find((i) => {
    const word = normKey(i.name).split(' ').find((w) => w.length >= 5);
    return !!word && t.includes(word);
  });
  return loose?.id ?? null;
}

/** Maps the insurer's wording of the service to a code of the tariff grid. */
export function matchService(raw: string, services: readonly Service[]): string | null {
  const t = normKey(raw);
  const rules: [RegExp, string][] = [
    [/heavy/, 'TOW-HVY-KM'],
    [/per km|intercity|inter city|long distance/, 'TOW-KM'],
    [/50 ?km|radius/, 'TOW-R50'],
    [/urban|city/, 'TOW-URB'],
    [/winch|extraction|recovery/, 'EXTR'],
    [/repair|jump|battery|wheel/, 'REP-SITE'],
    [/storage/, 'STOR'],
  ];
  for (const [re, code] of rules) if (re.test(t) && services.some((s) => s.code === code)) return code;
  return null;
}

export function parseOrder(text: string, insurers: readonly Insurer[], services: readonly Service[]): ParsedOrder {
  const out: ParsedOrder = {
    insurer: detectInsurer(text, insurers),
    fileRef: null, orderNo: null, incidentDate: null, insuredName: null, phone: null,
    vehicleModel: null, vehiclePlate: null, event: null, pickup: null, destination: null,
    serviceCode: null, distanceKm: null, roundTrip: 1,
  };
  for (const [field, re] of LABELS) {
    const v = text.match(re)?.[1]?.trim();
    if (!v) continue;
    if (field === 'incidentDate') out.incidentDate = parseDate(v);
    else if (field === 'orderNo') out.orderNo = fixDigits(v).replace(/\s+/g, '');
    else if (field === 'fileRef') out.fileRef = fixFileRef(v);
    else (out[field] as string | null) = v.replace(/\s{2,}/g, ' ');
  }
  // "Service order" in the header also starts with "Service": keep the first line that maps to a tariff.
  for (const m of text.matchAll(/^\s*service\s*[:;.]?\s*(.+)$/gim)) {
    out.serviceCode = matchService(m[1]!, services);
    if (out.serviceCode) break;
  }
  const dist = text.match(/^\s*distance\s*[:;.]?\s*([0-9OolI|]+(?:[.,]\d+)?)\s*km/im)?.[1];
  if (dist) out.distanceKm = Number(fixDigits(dist).replace(',', '.'));
  if (/^\s*round\s*trip\s*[:;.]?\s*yes/im.test(text)) out.roundTrip = 2;
  return out;
}
