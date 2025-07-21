<template>
  <Teleport to="body">
    <Transition name="toast">
      <div
        v-if="props.visible"
        :class="[
          'fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg text-white font-medium',
          props.type === 'success' ? 'bg-green-600' : 'bg-red-600'
        ]"
      >
        <div class="flex items-center space-x-2">
          <span v-if="props.type === 'success'" class="text-xl">✅</span>
          <span v-else class="text-xl">❌</span>
          <span>{{ props.message }}</span>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
const props = defineProps({
  visible: {
    type: Boolean,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  type: {
    type: String as () => 'success' | 'error',
    required: true
  }
});
</script>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(100%);
}
</style>
