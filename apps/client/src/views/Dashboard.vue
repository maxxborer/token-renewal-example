<template>
  <div class="min-h-screen bg-gray-100">
    <!-- Header -->
    <header class="bg-white shadow">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center py-6">
          <h1 class="text-3xl font-bold text-gray-900">Dashboard</h1>
          <div class="flex space-x-4">
            <button
              @click="authStore.expireToken('soft')"
              class="px-4 py-2 text-sm font-medium text-yellow-700 bg-yellow-100 rounded-md hover:bg-yellow-200"
            >
              Протухнуть слабо
            </button>
            <button
              @click="authStore.expireToken('hard')"
              class="px-4 py-2 text-sm font-medium text-red-700 bg-red-100 rounded-md hover:bg-red-200"
            >
              Протухнуть сильно
            </button>
            <button
              @click="authStore.logout()"
              class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              Выход
            </button>
          </div>
        </div>
      </div>
    </header>

    <!-- Main content -->
    <main class="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- REST API Tests -->
        <div class="bg-white rounded-lg shadow p-6">
          <h2 class="text-xl font-semibold mb-4">REST API тесты</h2>

          <div class="space-y-4">
            <button
              @click="testAxiosGet"
              class="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
            >
              GET /api/users
            </button>

            <button
              @click="testAxiosPost"
              class="w-full px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
            >
              POST /api/test
            </button>

            <button
              @click="testAxiosParallel"
              class="w-full px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700"
            >
              Параллельные запросы (3 шт)
            </button>

            <button
              @click="testAxiosCancel"
              class="w-full px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-md hover:bg-orange-700"
            >
              Тест отмены запроса
            </button>
          </div>

          <!-- Results -->
          <div v-if="axiosResults.length" class="mt-6">
            <h3 class="text-sm font-medium text-gray-700 mb-2">Результаты:</h3>
            <div class="space-y-2 max-h-60 overflow-y-auto">
              <div
                v-for="(result, index) in axiosResults"
                :key="index"
                :class="[
                  'p-3 rounded text-sm',
                  result.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                ]"
              >
                <div class="font-medium">{{ result.method }} {{ result.url }}</div>
                <div class="text-xs mt-1">{{ result.message }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- GraphQL Tests -->
        <div class="bg-white rounded-lg shadow p-6">
          <h2 class="text-xl font-semibold mb-4">GraphQL тесты</h2>

          <div class="space-y-4">
            <button
              @click="testApolloQuery"
              class="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
            >
              Query users
            </button>

            <button
              @click="testApolloMutation"
              class="w-full px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
            >
              Mutation testMutation
            </button>

            <button
              @click="testApolloParallel"
              class="w-full px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700"
            >
              Параллельные запросы (3 шт)
            </button>

            <button
              @click="testApolloAuthError"
              class="w-full px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
            >
              Тест GraphQL ошибки авторизации
            </button>

            <button
              @click="testApolloCancel"
              class="w-full px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-md hover:bg-orange-700"
            >
              Тест отмены запроса
            </button>
          </div>

          <!-- Results -->
          <div v-if="apolloResults.length" class="mt-6">
            <h3 class="text-sm font-medium text-gray-700 mb-2">Результаты:</h3>
            <div class="space-y-2 max-h-60 overflow-y-auto">
              <div
                v-for="(result, index) in apolloResults"
                :key="index"
                :class="[
                  'p-3 rounded text-sm',
                  result.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                ]"
              >
                <div class="font-medium">{{ result.operation }}</div>
                <div class="text-xs mt-1">{{ result.message }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Request Counter -->
      <div class="mt-6 bg-white rounded-lg shadow p-4">
        <div class="text-center">
          <p class="text-sm text-gray-600">Всего запросов: {{ totalRequests }}</p>
          <p class="text-xs text-gray-500 mt-1">Успешных: {{ successfulRequests }} | Ошибок: {{ failedRequests }}</p>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { testAxiosRequests } from '@/api/test-axios';
import { testApolloRequests } from '@/api/test-apollo';

const authStore = useAuthStore();

interface TestResult {
  success: boolean;
  message: string;
  method?: string;
  url?: string;
  operation?: string;
}

const axiosResults = ref<TestResult[]>([]);
const apolloResults = ref<TestResult[]>([]);

const totalRequests = computed(() => axiosResults.value.length + apolloResults.value.length);
const successfulRequests = computed(() =>
  [...axiosResults.value, ...apolloResults.value].filter(r => r.success).length
);
const failedRequests = computed(() =>
  [...axiosResults.value, ...apolloResults.value].filter(r => !r.success).length
);

// Axios tests
const testAxiosGet = async () => {
  const result = await testAxiosRequests.get();
  axiosResults.value.unshift(result);
};

const testAxiosPost = async () => {
  const result = await testAxiosRequests.post();
  axiosResults.value.unshift(result);
};

const testAxiosParallel = async () => {
  const results = await testAxiosRequests.parallel();
  axiosResults.value.unshift(...results);
};

const testAxiosCancel = async () => {
  const result = await testAxiosRequests.cancel();
  axiosResults.value.unshift(result);
};

// Apollo tests
const testApolloQuery = async () => {
  const result = await testApolloRequests.query();
  apolloResults.value.unshift(result);
};

const testApolloMutation = async () => {
  const result = await testApolloRequests.mutation();
  apolloResults.value.unshift(result);
};

const testApolloParallel = async () => {
  const results = await testApolloRequests.parallel();
  apolloResults.value.unshift(...results);
};

const testApolloAuthError = async () => {
  const result = await testApolloRequests.testAuthError();
  apolloResults.value.unshift(result);
};

const testApolloCancel = async () => {
  const result = await testApolloRequests.cancel();
  apolloResults.value.unshift(result);
};
</script>
