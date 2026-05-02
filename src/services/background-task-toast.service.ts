import { toast } from "sonner";

type ToastId = string | number;

interface BackgroundTaskToastOptions {
  id: ToastId;
  message: string;
  description?: string;
}

const DEFAULT_DURATION = 5000;

export const BackgroundTaskToast = {
  loading({ id, message, description }: BackgroundTaskToastOptions) {
    toast.loading(message, {
      id,
      description,
      duration: Infinity,
    });
  },

  success({ id, message, description }: BackgroundTaskToastOptions) {
    toast.success(message, {
      id,
      description,
      duration: DEFAULT_DURATION,
    });
  },

  error({ id, message, description }: BackgroundTaskToastOptions) {
    toast.error(message, {
      id,
      description,
      duration: 8000,
    });
  },

  info({ id, message, description }: BackgroundTaskToastOptions) {
    toast.info(message, {
      id,
      description,
      duration: DEFAULT_DURATION,
    });
  },

  dismiss(id: ToastId) {
    toast.dismiss(id);
  },
};
