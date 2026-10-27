'use client';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { DB, defaultDB, loadDB, saveDB, loadSession, saveSession } from './store';
import { Settings, Session } from './types';

interface POSContext {
  db: DB;
  save: (updater: (db: DB) => DB | void) => void;
  settings: Settings;
  session: Session | null;
  setSession: (s: Session | null) => void;
}

const Ctx = createContext<POSContext | null>(null);

export function POSProvider({
  children,
  initialData,
}: {
  children: React.ReactNode;
  initialData?: Partial<DB>;
}) {
  const [db, setDB] = useState<DB>(() => {
    const local = loadDB();
    if (!initialData) return local;
    // Merge server data over localStorage defaults (server is authoritative)
    return { ...defaultDB(), ...local, ...initialData } as DB;
  });
  const [session, setSessionState] = useState<Session | null>(() => loadSession());

  const save = useCallback((updater: (db: DB) => DB | void) => {
    setDB(prev => {
      const copy = JSON.parse(JSON.stringify(prev)) as DB;
      const result = updater(copy);
      const next = (result !== undefined ? result : copy) as DB;
      saveDB(next);
      return next;
    });
  }, []);

  const setSession = useCallback((s: Session | null) => {
    saveSession(s);
    setSessionState(s);
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
    <Ctx.Provider value={{ db, save, settings: db.settings, session, setSession }}>
      {children}
    </Ctx.Provider>
  );
}

export function usePOS(): POSContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('usePOS must be used inside POSProvider');
  return ctx;
}
