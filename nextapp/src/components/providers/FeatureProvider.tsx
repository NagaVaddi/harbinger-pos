'use client';

import React, { createContext, useContext, useMemo } from 'react';
import { FeatureKey, FeatureFlags, DEFAULT_FEATURE_FLAGS } from '@/lib/types';
import { usePOS } from '@/lib/context';

interface FeatureContextValue {
  flags: FeatureFlags;
  isEnabled: (key: FeatureKey) => boolean;
}

const FeatureContext = createContext<FeatureContextValue>({
  flags: DEFAULT_FEATURE_FLAGS,
  isEnabled: () => false,
});

export function FeatureProvider({ children }: { children: React.ReactNode }) {
  const { db } = usePOS();

  const value = useMemo<FeatureContextValue>(() => {
    const flags: FeatureFlags = {
      ...DEFAULT_FEATURE_FLAGS,
      ...(db.settings.features ?? {}),
    };
    return {
      flags,
      isEnabled: (key: FeatureKey) => !!flags[key],
    };
  }, [db.settings.features]);

  return (
    <FeatureContext.Provider value={value}>
      {children}
    </FeatureContext.Provider>
  );
}

export function useFeature() {
  return useContext(FeatureContext);
}
