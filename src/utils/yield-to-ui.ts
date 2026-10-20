import { AppState } from 'react-native';

/**
 * Lets the UI draw between batches of a long job. In the background there
 * is nothing to draw and iOS may hold timers back, so it continues at once
 * there, and a pending wait ends as soon as the app changes state
 * (ADR-0010: checks keep running after the user leaves the app).
 */
export function yieldToUi(): Promise<void> {
  if (AppState.currentState !== 'active') return Promise.resolve();
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      subscription.remove();
      resolve();
    };
    const subscription = AppState.addEventListener('change', finish);
    const timer = setTimeout(finish, 0);
  });
}
