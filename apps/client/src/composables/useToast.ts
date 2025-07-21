import { reactive } from 'vue';

interface ToastNotification {
  id: number;
  message: string;
  type: 'success' | 'error';
  visible: boolean;
}

const toasts = reactive<ToastNotification[]>([]);
let nextId = 1;

export function useToast() {
  const showToast = (message: string, type: 'success' | 'error', duration = 4000) => {
    const toast: ToastNotification = {
      id: nextId++,
      message,
      type,
      visible: true
    };

    toasts.push(toast);

    setTimeout(() => {
      hideToast(toast.id);
    }, duration);

    return toast.id;
  };

  const hideToast = (id: number) => {
    const index = toasts.findIndex(t => t.id === id);
    if (index !== -1) {
      toasts[index].visible = false;
      setTimeout(() => {
        toasts.splice(index, 1);
      }, 300); // Ждем окончания анимации
    }
  };

  const showSuccess = (message: string, duration?: number) => {
    return showToast(message, 'success', duration);
  };

  const showError = (message: string, duration?: number) => {
    return showToast(message, 'error', duration);
  };

  return {
    toasts,
    showToast,
    hideToast,
    showSuccess,
    showError
  };
}
