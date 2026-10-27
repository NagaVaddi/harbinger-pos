// ESC/POS thermal printer utility for KOT printing (58mm / 80mm)

export type PrinterWidth = 58 | 80;

const ESC = 0x1b;
const GS  = 0x1d;

// Core ESC/POS commands
const CMD = {
  INIT:        [ESC, 0x40],                      // Initialize printer
  ALIGN_LEFT:  [ESC, 0x61, 0x00],
  ALIGN_CENTER:[ESC, 0x61, 0x01],
  ALIGN_RIGHT: [ESC, 0x61, 0x02],
  BOLD_ON:     [ESC, 0x45, 0x01],
  BOLD_OFF:    [ESC, 0x45, 0x00],
  DOUBLE_HEIGHT:[ESC, 0x21, 0x10],               // Double height text
  NORMAL_SIZE: [ESC, 0x21, 0x00],
  FEED_LINE:   [0x0a],                           // LF
  FEED_3:      [ESC, 0x64, 0x03],               // Feed 3 lines
  CUT_PARTIAL: [GS,  0x56, 0x01],               // Partial cut
};

function bytes(...parts: (number[] | number)[]): Uint8Array {
  const flat: number[] = [];
  for (const p of parts) {
    if (Array.isArray(p)) flat.push(...p);
    else flat.push(p);
  }
  return new Uint8Array(flat);
}

function textBytes(str: string): number[] {
  return Array.from(new TextEncoder().encode(str));
}

function line(text: string): number[] {
  return [...textBytes(text), 0x0a];
}

function divider(width: PrinterWidth): number[] {
  return line('-'.repeat(width === 58 ? 32 : 48));
}

export interface KOTTicketData {
  kotNo:       string;
  orderNo:     string;
  tableName?:  string;
  kitchenName: string;
  items:       { name: string; qty: number; note?: string }[];
  createdAt:   string;
  width?:      PrinterWidth;
  orderMeta?:  Record<string, string>;
}

export function buildKOTTicket(data: KOTTicketData): Uint8Array {
  const w = data.width ?? 80;
  const buf: number[] = [];

  const push = (...cmds: number[][]) => cmds.forEach(c => buf.push(...c));

  push(CMD.INIT, CMD.ALIGN_CENTER, CMD.BOLD_ON, CMD.DOUBLE_HEIGHT);
  push(line('KITCHEN ORDER'));
  push(CMD.NORMAL_SIZE, CMD.BOLD_OFF);
  push(divider(w));

  push(CMD.ALIGN_LEFT, CMD.BOLD_ON);
  push(line(`KOT #: ${data.kotNo}`));
  push(line(`Order: ${data.orderNo}`));
  push(CMD.BOLD_OFF);

  if (data.tableName) push(line(`Table: ${data.tableName}`));
  push(line(`Station: ${data.kitchenName}`));
  push(line(`Time: ${new Date(data.createdAt).toLocaleTimeString()}`));

  // Print order-level metadata (vehicle/patient info) at the top of the KOT
  if (data.orderMeta && Object.keys(data.orderMeta).length > 0) {
    push(divider(w));
    push(CMD.BOLD_ON);
    for (const [key, val] of Object.entries(data.orderMeta)) {
      if (val) push(line(`${key}: ${val}`));
    }
    push(CMD.BOLD_OFF);
  }

  push(divider(w));

  push(CMD.BOLD_ON);
  push(line('QTY  ITEM'));
  push(CMD.BOLD_OFF);
  push(divider(w));

  for (const item of data.items) {
    const qty = String(item.qty).padEnd(5);
    push(line(`${qty}${item.name}`));
    if (item.note) {
      push(line(`     >> ${item.note}`));
    }
  }

  push(divider(w));
  push(CMD.ALIGN_CENTER);
  push(line('--- END OF KOT ---'));
  push(CMD.FEED_3, CMD.CUT_PARTIAL);

  return bytes(buf);
}

// ── Local Print Agent (solves HTTPS Mixed Content) ──────────────────────────
//
// Vercel serves over HTTPS, which blocks direct HTTP requests to LAN printers.
// The Harbinger Print Agent (scripts/harbinger-print-agent.js) runs locally on
// port 9101 and forwards ESC/POS bytes over raw TCP — browsers allow
// localhost HTTPS→HTTP requests so this bridge works.
//
// Throw PrintAgentOfflineError when the agent is not reachable so callers can
// show a "download + install" fallback modal instead of a raw network error.

export class PrintAgentOfflineError extends Error {
  constructor() {
    super('PRINT_AGENT_OFFLINE');
    this.name = 'PrintAgentOfflineError';
  }
}

const PRINT_AGENT_URL = 'http://127.0.0.1:9101/print';

export async function sendToPrintAgent(
  printerIp: string,
  printerPort: number,
  data: Uint8Array,
): Promise<{ ok: boolean; error?: string }> {
  let res: Response;
  try {
    res = await fetch(PRINT_AGENT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip: printerIp, port: printerPort, data: Array.from(data) }),
    });
  } catch {
    throw new PrintAgentOfflineError();
  }
  const body = await res.json().catch(() => ({})) as { ok?: boolean; error?: string };
  if (!res.ok) return { ok: false, error: body.error ?? `HTTP ${res.status}` };
  return { ok: true };
}

// Send raw bytes directly to a printer's HTTP endpoint.
// Use this only in local/dev environments where the printer itself serves HTTP.
export async function sendToPrinter(
  printerIp: string,
  printerPort: number,
  data: Uint8Array,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`http://${printerIp}:${printerPort}/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: data.buffer as ArrayBuffer,
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
