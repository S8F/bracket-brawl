// Keeps one open tournament in memory and saves every change to Supabase.
// The screen only ever shows data that is SAVED: a change is applied to the screen after the save
// worked. If the save fails (for example no internet) the screen simply stays on the saved data
// and a "Couldn't save" warning is shown. While one save is running, other changes are ignored,
// so two quick taps can never store a half-finished state.

import type { SupabaseClient } from '@supabase/supabase-js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { loadTournament, saveTournament } from '../data/tournamentRepo';
import type { StoredTournament } from '../lib/tournamentSummary';
import type { Tournament } from '../lib/types';

export interface OpenTournament {
  stored: StoredTournament | null;
  loading: boolean;
  loadError: string | null;
  saving: boolean;
  saveError: string | null;
  // Saves the new state. Resolves true if it was stored, false if not (the screen is unchanged).
  apply: (next: Tournament) => Promise<boolean>;
  dismissSaveError: () => void;
  reload: () => void;
}

export function useOpenTournament(client: SupabaseClient, id: string): OpenTournament {
  const [stored, setStored] = useState<StoredTournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // The latest saved copy, readable inside async code without going stale.
  const savedRef = useRef<StoredTournament | null>(null);
  const savingRef = useRef(false);
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void loadTournament(client, id).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (res.ok) {
        savedRef.current = res.value;
        setStored(res.value);
        setLoadError(null);
      } else {
        setLoadError(res.message);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [client, id, reloadCount]);

  const apply = useCallback(
    async (next: Tournament): Promise<boolean> => {
      const current = savedRef.current;
      if (!current || savingRef.current) return false;
      savingRef.current = true;
      setSaving(true);
      const res = await saveTournament(client, id, next, current.finishedAt);
      savingRef.current = false;
      setSaving(false);
      if (!res.ok) {
        setSaveError(`Couldn't save — your last change was not stored. ${res.message}`);
        return false;
      }
      const updated: StoredTournament = { ...current, tournament: next, finishedAt: res.value };
      savedRef.current = updated;
      setStored(updated);
      setSaveError(null);
      return true;
    },
    [client, id],
  );

  return {
    stored,
    loading,
    loadError,
    saving,
    saveError,
    apply,
    dismissSaveError: () => setSaveError(null),
    reload: () => {
      setLoading(true);
      setReloadCount((n) => n + 1);
    },
  };
}
