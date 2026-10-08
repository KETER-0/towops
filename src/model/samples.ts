// The fake order forms shown on the Import screen. scripts/make-samples.ts
// renders each one to public/samples/<file> as a photographed page, and the
// smoke test checks that OCR + parsing recovers `expect`.

export interface SampleOrder {
  file: string;
  insurerName: string;
  /** Printed lines, in order, under the insurer header. */
  lines: [string, string][];
  expect: { insurer: string; fileRef: string; serviceCode: string; distanceKm: number | null };
}

export const SAMPLE_ORDERS: SampleOrder[] = [
  {
    file: 'order-medina.png',
    insurerName: 'Medina Assist Services',
    lines: [
      ['File ref', 'ME-26-48213'], ['Order no', '774120'], ['Date', '21/09/2026'],
      ['Insured', 'Karim Alaoui'], ['Phone', '06 XX XX 41 27'], ['Vehicle', 'Dacia Logan'], ['Plate', '4821-A-6'],
      ['Event', 'Engine breakdown'], ['Pick-up', 'N13 km 24, Azrou'], ['Destination', 'Garage Al Amal, Fes'],
      ['Service', 'Flatbed tow, intercity, per km'], ['Distance', '106 km'], ['Round trip', 'no'],
    ],
    expect: { insurer: 'medina', fileRef: 'ME-26-48213', serviceCode: 'TOW-KM', distanceKm: 106 },
  },
  {
    file: 'order-cobalt.png',
    insurerName: 'Cobalt Assistance',
    lines: [
      ['File ref', 'CO-26-31877'], ['Order no', '552908'], ['Date', '26/09/2026'],
      ['Insured', 'Salma Bennis'], ['Phone', '06 XX XX 73 05'], ['Vehicle', 'Peugeot 208'], ['Plate', '18822-B-48'],
      ['Event', 'Accident'], ['Pick-up', 'Ring Road km 6, Meknes'], ['Destination', 'Auto Service Saiss, Meknes'],
      ['Service', 'Flatbed tow, urban flat rate'], ['Distance', '9 km'], ['Round trip', 'no'],
    ],
    expect: { insurer: 'cobalt', fileRef: 'CO-26-31877', serviceCode: 'TOW-URB', distanceKm: 9 },
  },
  {
    file: 'order-kestrel.png',
    insurerName: 'Kestrel Travel Assist',
    lines: [
      ['File ref', 'KE-26-90412'], ['Order no', '310067'], ['Date', '27/09/2026'],
      ['Insured', 'Thomas Girard'], ['Phone', '+33 6 XX XX 18 44'], ['Vehicle', 'Renault Kangoo'], ['Plate', 'FR GH-512-KL'],
      ['Event', 'Gearbox failure'], ['Pick-up', 'A2 motorway km 88, El Hajeb'], ['Destination', 'Dealer workshop, Rabat'],
      ['Service', 'Flatbed tow, long distance, per km'], ['Distance', '164 km'], ['Round trip', 'yes'],
    ],
    expect: { insurer: 'kestrel', fileRef: 'KE-26-90412', serviceCode: 'TOW-KM', distanceKm: 164 },
  },
];
