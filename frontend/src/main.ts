import App from './App.svelte';
import './app.css';

const target = document.getElementById('app');
if (!target) {
  document.body.innerHTML = '<p style="color:#39ff14;padding:2rem;">Erro: elemento #app não encontrado.</p>';
} else {
  target.innerHTML = '';
  new App({ target });
}
