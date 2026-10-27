'use client';
import { useState } from 'react';
import { usePOS } from '@/lib/context';
import { PredefinedNote } from '@/lib/types';
import { uid } from '@/lib/fmt';

export default function PredefinedNotesPage() {
  const { db, save } = usePOS();
  const [newText, setNewText] = useState('');

  const notes = db.predefinedNotes ?? [];

  const handleAdd = () => {
    const text = newText.trim();
    if (!text) return;
    const note: PredefinedNote = { id: uid(), text, active: true };
    save(d => { d.predefinedNotes = [...(d.predefinedNotes ?? []), note]; return d; });
    setNewText('');
  };

  const handleToggle = (id: string) => {
    save(d => {
      const n = d.predefinedNotes?.find(x => x.id === id);
      if (n) n.active = !n.active;
      return d;
    });
  };

  const handleDelete = (id: string) => {
    save(d => { d.predefinedNotes = d.predefinedNotes?.filter(x => x.id !== id) ?? []; return d; });
  };

  return (
    <div style={{ maxWidth: 520 }}>
      <h1 style={{ marginBottom: 4 }}>Item Note Presets</h1>
      <p style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 24 }}>
        Quick modifier buttons shown when a waiter adds a note to an order line.
      </p>

      <div className="card">
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <input
            className="inp"
            placeholder='e.g. "No garlic"'
            value={newText}
            onChange={e => setNewText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            style={{ flex: 1 }}
          />
          <button className="btn btn-primary" onClick={handleAdd}>+ Add</button>
        </div>

        {notes.length === 0 ? (
          <p style={{ color: 'var(--text2)', textAlign: 'center', padding: '20px 0' }}>No presets yet.</p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {notes.map(n => (
              <div key={n.id} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: n.active ? 'var(--bg3)' : 'transparent',
                border: `1px solid ${n.active ? 'var(--border)' : 'var(--border)'}`,
                borderRadius: 20, padding: '5px 10px',
                opacity: n.active ? 1 : 0.45,
              }}>
                <span style={{ fontSize: 13 }}>{n.text}</span>
                <button onClick={() => handleToggle(n.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--text2)', padding: 0 }}>
                  {n.active ? 'off' : 'on'}
                </button>
                <button onClick={() => handleDelete(n.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--red)', padding: 0, lineHeight: 1 }}>
                  &times;
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
