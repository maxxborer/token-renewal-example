import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import { setupAxios } from './api/axios';
import { apolloClient } from './api/apollo';
import { DefaultApolloClient } from '@vue/apollo-composable';
import './styles/main.css';

const app = createApp(App);
const pinia = createPinia();

// Настраиваем Axios interceptors
setupAxios();

app.use(pinia);
app.use(router);
app.provide(DefaultApolloClient, apolloClient);

app.mount('#app');
