'use client';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { DB, loadDB, saveDB } from './store';
import { Settings } from './types';

interface POSContext {
  db: DB;
  save: (updater: (db: DB) => DB | void) => void;
  settings: Settings;
}

const Ctx = createContext<POSContext | null>(null);

export function POSProvider({ children }: { children: React.ReactNode }) {
  const [db, setDB] = useState<DB>(() => loadDB());

  const save = useCallback((updater: (db: DB) => DB | void) => {
    setDB(prev => {
      const copy = JSON.parse(JSON.stringify(prev)) as DB;
      const result = updater(copy);
      const next = (result !== undefined ? result : copy) as DB;
      saveDB(next);
      return next;
    });
  }, []);

  // Sync across tabs
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'harbinger_pos' && e.newValue) {
        try { setDB(JSON.parse(e.newValue)); } catch { /* ignore */ }
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return (
    <Ctx.Provider value={{ db, save, settings: db.settings }}>
      {children}
    </Ctx.Provider>
  );
}

export function usePOS(): POSContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('usePOS must be used inside POSProvider');
  return ctx;
}
