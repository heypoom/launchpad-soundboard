import Vue from 'vue'
import VueRouter from 'vue-router'

import App from './App.vue'
import Soundboard from './Soundboard.vue'

Vue.use(VueRouter)

const routes = [
  {path: '/', component: Soundboard},
]

const router = new VueRouter({routes})

const app = new Vue({
  render: (h) => h(App),
  router,
  components: {App},
}).$mount('#app')

window.app = app

