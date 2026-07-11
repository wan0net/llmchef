export interface GitCredentialRequest {
  url: string;
  resolve: (value: { username: string; password: string } | null) => void;
}

const queue: GitCredentialRequest[] = [];
let listeners: (() => void)[] = [];

const notify = () => listeners.forEach((cb) => cb());

export const GitCredentialDialogService = {
  requestCredentials(url: string): Promise<{ username: string; password: string } | null> {
    return new Promise((resolve) => {
      queue.push({ url, resolve });
      notify();
    });
  },

  getCurrentRequest(): GitCredentialRequest | undefined {
    return queue[0];
  },

  resolveCurrent(value: { username: string; password: string } | null): void {
    const req = queue.shift();
    if (req) {
      req.resolve(value);
    }
    notify();
  },

  subscribe(callback: () => void): () => void {
    listeners.push(callback);
    return () => {
      listeners = listeners.filter((cb) => cb !== callback);
    };
  },
};
