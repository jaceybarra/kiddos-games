import './ui/styles.css';
import { App } from './app/App';

const app = new App();
void app.boot().then(() => {
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('dev')) {
    void import('./dev/devTools').then((m) => m.installDevTools(app));
  }
});
