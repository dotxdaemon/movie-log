// ABOUTME: Loads persisted archive state and paths while subscribing to live main-process updates.
// ABOUTME: Owns retry, loading, and capture-readiness behavior independently from renderer interactions.
import { startTransition, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import type { MovieLogState } from '../shared/types.js';
import { readArchiveLoadFailureMessage } from './load-error.js';

const emptyState: MovieLogState = { films: {}, history: [], libraryItems: [], watchedFolders: [] };

export function updateArchiveState(nextState: MovieLogState, setState: Dispatch<SetStateAction<MovieLogState>>): void {
  startTransition(() => setState(nextState));
}

export function useArchiveData() {
  const [dataFilePath, setDataFilePath] = useState('');
  const [noteFilePath, setNoteFilePath] = useState('');
  const [state, setState] = useState<MovieLogState>(emptyState);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    let hasLiveState = false;
    const captureProfile = new URLSearchParams(window.location.search).get('capture');
    document.documentElement.dataset.movieLogCaptureReady = 'false';

    if (captureProfile === 'loading') {
      document.documentElement.dataset.movieLogCaptureReady = 'true';
    }

    const unsubscribe = window.movieLog.subscribe((nextState) => {
      hasLiveState = true;
      updateArchiveState(nextState, setState);
    });

    void Promise.all([window.movieLog.getState(), window.movieLog.getDataFilePath(), window.movieLog.getNoteFilePath()])
      .then(([nextState, nextDataFilePath, nextNoteFilePath]) => {
        if (!isMounted) {
          return;
        }

        if (!hasLiveState) {
          updateArchiveState(nextState, setState);
        }

        setDataFilePath(nextDataFilePath);
        setNoteFilePath(nextNoteFilePath);
        setLoadError(null);
        document.documentElement.dataset.movieLogCaptureReady = 'true';
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setLoadError(readArchiveLoadFailureMessage(error));
          document.documentElement.dataset.movieLogCaptureReady = 'true';
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
      delete document.documentElement.dataset.movieLogCaptureReady;
      unsubscribe();
    };
  }, [loadAttempt]);

  return {
    dataFilePath,
    loadError,
    loading,
    noteFilePath,
    retryLoad: () => {
      setLoadError(null);
      setLoading(true);
      setLoadAttempt((attempt) => attempt + 1);
    },
    setState,
    state
  };
}
