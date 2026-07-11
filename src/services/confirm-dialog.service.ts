export interface ConfirmDialogOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

interface ConfirmRequest extends ConfirmDialogOptions {
  id: number;
  resolve: (value: boolean) => void;
}

let requestId = 0;
let listener: ((requests: ConfirmRequest[]) => void) | null = null;
const queue: ConfirmRequest[] = [];

const flush = () => {
  listener?.([...queue]);
};

export const ConfirmDialogService = {
  setListener(callback: ((requests: ConfirmRequest[]) => void) | null) {
    listener = callback;
    if (callback) {
      flush();
    }
  },

  confirm(options: ConfirmDialogOptions): Promise<boolean> {
    return new Promise((resolve) => {
      const id = ++requestId;
      queue.push({ ...options, id, resolve });
      flush();
    });
  },

  getRequests(): ConfirmRequest[] {
    return [...queue];
  },

  resolve(id: number, value: boolean) {
    const index = queue.findIndex((r) => r.id === id);
    if (index !== -1) {
      const [request] = queue.splice(index, 1);
      request.resolve(value);
      flush();
    }
  },
};

export type { ConfirmRequest };
