'use client';
import { useState } from 'react';
import { usePOS } from '@/lib/context';
import { BusinessHoursDay } from '@/lib/types';
import { DEFAULT_BUSINESS_HOURS } from '@/lib/guards';

export default function BusinessHoursPage() {
  const { db, save, session } = usePOS();
  const isAdmin = session?.role === 'admin';

  const [hours, setHours] = useState<BusinessHoursDay[]>(
    db.settings.businessHours ?? DEFAULT_BUSINESS_HOURS,
  );
  const [saved, setSaved] = useState(false);

  if (!isAdmin) {
    return (
      <div className="card" style={{ maxWidth: 480 }}>
        <p style={{ color: 'var(--red)' }}>Admin access required to edit business hours.</p>
      </div>
    );
  }

  const set = (idx: number, field: keyof BusinessHoursDay, val: unknown) => {
    setHours(h => h.map((d, i) => i === idx ? { ...d, [field]: val } : d));
    setSaved(false);
  };

  const handleSave = () => {
    save(d => { d.settings = { ...d.settings, businessHours: hours }; return d; });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div style={{ maxWidth: 620 }}>
      <h1 style={{ marginBottom: 4 }}>Business Hours</h1>
      <p style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 24 }}>
        Set opening and closing times. The register shows a warning popup when closing time is reached.
      </p>
      <div className="card">
        <div style={{ display: 'grid', gap: 10 }}>
          {hours.map((day, i) => (
            <div key={day.day} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, width: 140 }}>
                <input type="checkbox" checked={day.enabled}
                  onChange={e => set(i, 'enabled', e.target.checked)} style={{ width: 16, height: 16 }} />
                <span style={{ fontWeight: day.enabled ? 600 : 400, color: day.enabled ? 'var(--text)' : 'var(--text2)' }}>
                  {day.day}
                </span>
              </label>
              {day.enabled ? (
                <>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text2)' }}>
                    Open
                    <input type="time" className="inp" value={day.open}
                      onChange={e => set(i, 'open', e.target.value)} style={{ width: 110 }} />
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text2)' }}>
                    Close
                    <input type="time" className="inp" value={day.close}
                      onChange={e => set(i, 'close', e.target.value)} style={{ width: 110 }} />
                  </label>
                </>
              ) : (
                <span style={{ fontSize: 13, color: 'var(--text2)', fontStyle: 'italic' }}>Closed</span>
              )}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 24 }}>
          <button className="btn btn-primary" onClick={handleSave}>Save hours</button>
          {saved && <span style={{ color: 'var(--green)', fontSize: 13 }}>Saved</span>}
        </div>
      </div>
    </div>
  );
}
