// Formatting utilities

export function fmt(n: number, dec = 2): string {
  return n.toFixed(dec).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function fmtCurrency(n: number, currency = 'AED'): string {
  return `${currency} ${fmt(n)}`;
}

export function fmtDate(ts: string | number | Date): string {
  return new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function fmtDateTime(ts: string | number | Date): string {
  return new Date(ts).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function now(): string {
  return new Date().toISOString();
}

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function r2(n: number): number {
  return Math.round(n * 100) / 100;
}
