/** Точка входа: подключает игру к странице. */
import { createApp } from './ui/app.js';

const app = createApp(document.getElementById('app'));
app.start();

// Для отладки из консоли браузера: window.__auction.getGame()
window.__auction = app;
