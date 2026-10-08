// The TowOps data model. Two sides of one business, linked by the truck:
//
//   Billing  (missions ordered by insurers -> priced lines -> invoices -> payments)
//   Fleet    (what each truck earns and costs, month by month)
//
// Every row that belongs to a truck carries `truck`, the truck's `key`
// (its plate, normalised by `truckKey`). Dates are ISO "YYYY-MM-DD",
// months "YYYY-MM", amounts in MAD (Moroccan dirham), VAT included.

// ---------- Reference data ----------

export interface Company {
  name: string;
  tagline: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  /** Tax identifiers are deliberately fake in the demo. */
  taxId: string;
  bank: string;
}

export interface Insurer {
  id: string;
  name: string;
  address: string;
  taxId: string;
  /** Foreign insurers are invoiced without VAT (export of services). */
  vatExempt: boolean;
  /** Days the insurer usually takes to pay an invoice. Drives the fake data only. */
  paysAfterDays: number;
}

/** How a service is priced. */
export type PricingMode =
  | 'flat' // one price, quantity fixed at 1
  | 'km' // rate per kilometre
  | 'quantity' // rate per unit (night of storage, hour of waiting)
  | 'price'; // amount typed by the operator (tolls, parts)

/** One entry of the tariff grid. */
export interface Service {
  code: string;
  label: string;
  mode: PricingMode;
  /** VAT-included rate in MAD. Null for `price`: typed per mission. */
  rate: number | null;
  /** VAT rate in whole percent: 0, 10 or 20. */
  vat: 0 | 10 | 20;
  /** Done by a flatbed truck. Only towing lines priced per km can be split between trucks. */
  towing: boolean;
  /** A pass-through cost re-invoiced at cost (tolls), not a service. */
  expense: boolean;
}

export interface Truck {
  /** Normalised plate, the join key used everywhere. */
  key: string;
  plate: string;
  model: string;
  /** Short name used by the team. */
  name: string;
}

/** A driver assigned to a truck at a monthly salary, from month `from`. */
export interface Assignment {
  id: string;
  truck: string;
  driver: string;
  salary: number;
  from: string;
}

// ---------- Billing ----------

/** One billable line of a mission: rate x roundTrip x quantity. */
export interface Line {
  serviceCode: string;
  label: string;
  rate: number | null;
  /** 1 = one way, 2 = return trip. */
  roundTrip: number;
  /** Kilometres, nights, hours, or 1 for flat services. */
  quantity: number | null;
  /** Stored, never recomputed: an issued invoice must not move when the tariff grid changes. */
  total: number | null;
  vat: 0 | 10 | 20;
}

/** A second (or third) truck on a long tow, with the kilometres it drove. */
export interface TruckShare {
  truck: string;
  km: number;
}

export type PhotoSlot = 'orderForm' | 'registration' | 'insurance' | 'vehicle';
export const PHOTO_SLOTS: PhotoSlot[] = ['orderForm', 'registration', 'insurance', 'vehicle'];

/** Workflow state the operator sets. "Invoiced" and "paid" are NOT states: they are dates. */
export type MissionState = 'in_progress' | 'cancelled';

/** A job ordered by an insurer: tow, repair on site, storage... */
export interface Mission {
  id: string;
  insurer: string;
  /** The insurer's file reference. */
  fileRef: string;
  orderNo: string;
  incidentDate: string;
  insuredName: string;
  /** Masked in the demo. */
  phone: string;
  vehiclePlate: string;
  vehicleModel: string;
  event: string;
  pickup: string;
  destination: string;
  /** Truck 1: the one that did the job (keeps the remaining km of a shared tow). */
  truck: string;
  /** Extra trucks on a shared tow. Empty = one truck. */
  shares: TruckShare[];
  lines: Line[];
  state: MissionState;
  /** Number of photos received per required slot. All > 0 = ready to invoice. */
  photos: Record<PhotoSlot, number>;
  /** Set = invoiced. The month it counts in for billing. */
  invoiceDate: string | null;
  invoiceNo: string | null;
  /** Set = paid. Payment is an axis above invoicing, not a fifth state. */
  paidDate: string | null;
  /** Extra paid in cash by the customer, counted as the truck's cash income, never invoiced. */
  supplement: number;
  comment: string;
  /** How the mission entered the system. */
  source: 'pdf' | 'email' | 'photo';
}

// ---------- Fleet ----------

/** A private job paid in cash on the spot. */
export interface CashJob {
  id: string;
  truck: string;
  date: string;
  amount: number;
  note: string;
}

/** A job for a business client on credit: the client owes `amount`. */
export interface CreditJob {
  id: string;
  truck: string;
  date: string;
  client: string;
  amount: number;
  note: string;
}

/** A payment from a credit client. Belongs to the client, not to a truck. */
export interface ClientPayment {
  id: string;
  client: string;
  date: string;
  amount: number;
}

/** Any truck cost that is not fuel or salary: tyres, repairs, washing... */
export interface Charge {
  id: string;
  truck: string;
  date: string;
  category: string;
  amount: number;
  note: string;
}

/** A fill-up. On credit it becomes a debt to the station. */
export interface FuelFill {
  id: string;
  truck: string;
  station: string;
  date: string;
  payment: 'credit' | 'cash';
  amount: number;
  litres: number;
  /** Odometer reading at the pump: drives L/100 km, full tank to full tank. */
  odometer: number;
}

/** A payment to a station to settle fuel taken on credit. */
export interface StationPayment {
  id: string;
  station: string;
  date: string;
  amount: number;
}

// ---------- The whole dataset ----------

export interface Dataset {
  company: Company;
  insurers: Insurer[];
  services: Service[];
  trucks: Truck[];
  assignments: Assignment[];
  missions: Mission[];
  cashJobs: CashJob[];
  creditJobs: CreditJob[];
  clientPayments: ClientPayment[];
  charges: Charge[];
  fuelFills: FuelFill[];
  stationPayments: StationPayment[];
}

/** The demo's fixed "today": the fake data is generated up to this day. */
export const DEMO_TODAY = '2026-09-28';
