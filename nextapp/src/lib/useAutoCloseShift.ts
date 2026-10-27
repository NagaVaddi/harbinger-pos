'use client';
import { useEffect, useState } from 'react';
import { usePOS } from './context';
import type { Shift } from './types';

// Returns minutes-since-midnight from a "HH:MM" string
function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m ?? 0);
}

// Day names indexed 0 (Sunday) … 6 (Saturday) — matches getDay()
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export interface AutoCloseState {
  shouldClose: boolean;
  openShift: Shift | null;
}

export function useAutoCloseShift(): AutoCloseState {
  const { db } = usePOS();
  const [state, setState] = useState<AutoCloseState>({ shouldClose: false, openShift: null });

  useEffect(() => {
    function check() {
      const { settings, shifts } = db;

      // Feature must be enabled
      if (!settings.autoCloseShift) {
        setState({ shouldClose: false, openShift: null });
        return;
      }

      const hours = settings.businessHours;
      if (!hours || hours.length === 0) return;

      // Find the currently open shift
      const openShift = shifts.find(s => s.status === 'open') ?? null;
      if (!openShift) {
        setState({ shouldClose: false, openShift: null });
        return;
      }

      // Determine which business-hours row applies (using the shift's open date)
      const openedAt = new Date(openShift.openedAt);
      const dayName = DAY_NAMES[openedAt.getDay()];
      const dayConfig = hours.find(d => d.day === dayName);

      if (!dayConfig || !dayConfig.enabled) {
        setState({ shouldClose: false, openShift: null });
        return;
      }

      const openMin = toMin(dayConfig.open);
      const closeMin = toMin(dayConfig.close);

      // Build the absolute close DateTime relative to when the shift opened
      const closeDate = new Date(openedAt);
      closeDate.setHours(Math.floor(closeMin / 60), closeMin % 60, 0, 0);

      // Cross-midnight: if close time is earlier in the day than open time,
      // the close falls on the NEXT calendar day
      if (closeMin <= openMin) {
        closeDate.setDate(closeDate.getDate() + 1);
      }

      const now = new Date();
      const past = now >= closeDate;

      setState({ shouldClose: past, openShift: past ? openShift : null });
    }

    check();
    const id = setInterval(check, 60_000); // check every minute
    return () => clearInterval(id);
  }, [db]);

  return state;
}
