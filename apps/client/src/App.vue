<template>
  <div class="min-h-screen bg-gray-100">
    <RouterView />

    <!-- Toast Container -->
    <div class="fixed top-4 right-4 z-50 space-y-2">
      <Toast
        v-for="toast in toasts"
        :key="toast.id"
        :visible="toast.visible"
        :message="toast.message"
        :type="toast.type"
      />
    </div>
  </div>
</template>

<script setup>
import { RouterView } from 'vue-router';
import Toast from './components/Toast.vue';
import { useToast } from './composables/useToast';

// Получаем глобальные toasts
const toastManager = useToast();
const toasts = toastManager.toasts;
</script>
