import { createApp } from './bootstrap';
void createApp().then(app => app.listen(Number(process.env.API_PORT ?? 3001), process.env.API_HOST ?? '127.0.0.1'))
  .catch(() => { console.error('Démarrage impossible. Vérifiez la configuration et les services.'); process.exit(1); });
