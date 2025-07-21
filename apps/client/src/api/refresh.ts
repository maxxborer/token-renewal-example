import { useToast } from '@/composables/useToast';
import router from '@/router';
import { useAuthStore } from '@/stores/auth';

const { showSuccess, showError } = useToast();

// Функция обновления токена
export async function refresh(): Promise<boolean> {
  try {
    const response = await fetch('/auth/refresh', {
      method: 'POST',
      credentials: 'include'
    });

    const data = await response.json();

    if (data.success) {
      showSuccess('Токен успешно обновлен', 2000);
      return true;
    } else {
      showError('Не удалось обновить токен', 3000);
      return false;
    }
  } catch (error) {
    console.error('Token refresh failed:', error);
    showError('Ошибка обновления токена', 3000);
    return false;
  }
}

// Функция вызываемая при невозможности обновить токен
export function onRefreshFailed(): void {
  showError('Не удалось обновить токен', 3000);
  const authStore = useAuthStore();
  authStore.logout();
  router.push('/login');
}
