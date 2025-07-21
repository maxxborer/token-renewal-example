import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import router from '@/router';

export const useAuthStore = defineStore('auth', () => {
  const user = ref<{ username: string } | null>(null);
  const isAuthenticated = computed(() => !!user.value);

  const login = async (username: string, password: string) => {
    try {
      const response = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (data.success) {
        user.value = { username: data.username };
        router.push('/dashboard');
        return { success: true };
      } else {
        return { success: false, message: data.message };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, message: 'Ошибка входа' };
    }
  };

  const logout = async () => {
    try {
      await fetch('/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });

      user.value = null;
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const expireToken = async (type: 'soft' | 'hard') => {
    try {
      await fetch(`/auth/expire/${type}`, {
        method: 'POST',
        credentials: 'include'
      });
    } catch (error) {
      console.error('Expire token error:', error);
    }
  };

  const checkAuth = () => {
    // В реальном приложении здесь была бы проверка токена
    // Для демо просто считаем, что пользователь авторизован, если есть cookie
    return isAuthenticated.value;
  };

  return {
    user,
    isAuthenticated,
    login,
    logout,
    expireToken,
    checkAuth
  };
});
