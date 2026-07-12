import { useState, useCallback, useEffect } from 'react';

interface DriveState {
  isSignedIn: boolean;
  accessToken: string | null;
  loading: boolean;
  error: string | null;
}

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Impossible de charger ${src}`));
    document.body.appendChild(script);
  });
}

export function useDrive() {
  const [state, setState] = useState<DriveState>({
    isSignedIn: false,
    accessToken: null,
    loading: false,
    error: null,
  });
  const [tokenClient, setTokenClient] = useState<unknown>(null);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    let cancelled = false;
    (async () => {
      try {
        await loadScript('https://accounts.google.com/gsi/client');
        await loadScript('https://apis.google.com/js/api.js');
        if (cancelled) return;

        const gapi = (window as unknown as { gapi?: { client?: { load: (name: string, version?: string) => Promise<void> } } }).gapi;
        if (gapi?.client) {
          await gapi.client.load('drive', 'v3');
        }

        const google = (window as unknown as { google?: { accounts: { oauth2: { initTokenClient: (cfg: unknown) => unknown } } } }).google;
        if (google?.accounts?.oauth2) {
          const client = google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: SCOPES,
            callback: (response: { access_token?: string; error?: string }) => {
              if (response.error) {
                setState((s) => ({ ...s, error: response.error || 'Erreur OAuth', loading: false }));
                return;
              }
              if (response.access_token) {
                setState({
                  isSignedIn: true,
                  accessToken: response.access_token,
                  loading: false,
                  error: null,
                });
              }
            },
          });
          setTokenClient(client);
        }
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Erreur Google Drive';
        setState((s) => ({ ...s, error: message }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(() => {
    if (!GOOGLE_CLIENT_ID) {
      setState((s) => ({ ...s, error: 'Google Client ID non configuré' }));
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    if (typeof tokenClient === 'function') {
      (tokenClient as unknown as { requestAccessToken: () => void }).requestAccessToken();
    } else {
      setState((s) => ({ ...s, loading: false, error: 'Client Google non initialisé' }));
    }
  }, [tokenClient]);

  const saveFile = useCallback(
    async (name: string, content: string, folderId?: string) => {
      if (!state.accessToken) {
        throw new Error('Non connecté à Google Drive');
      }

      const metadata: Record<string, string> = {
        name,
        mimeType: 'text/markdown',
      };
      if (folderId) {
        metadata.parents = folderId;
      }

      const boundary = '-------314159265358979323846';
      const delimiter = `\r\n--${boundary}\r\n`;
      const closeDelim = `\r\n--${boundary}--`;

      const body =
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: text/markdown\r\n\r\n' +
        content +
        closeDelim;

      const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${state.accessToken}`,
          'Content-Type': `multipart/related; boundary="${boundary}"`,
        },
        body,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `Erreur Drive HTTP ${res.status}`);
      }

      return await res.json();
    },
    [state.accessToken]
  );

  return { ...state, login, saveFile, configured: !!GOOGLE_CLIENT_ID };
}
