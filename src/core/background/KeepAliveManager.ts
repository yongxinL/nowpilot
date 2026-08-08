// src/core/background/KeepAliveManager.ts — MV3 service-worker keepalive:
// a recurring chrome.alarms 'nowpilot-keepalive' (0.5 min) touches the SW so it
// is not killed mid-session. The onAlarm handler is a keepalive touch ONLY —
// R-3: no AI/IndexedDB work in the background SW; the panel-ping heartbeat is
// BroadcastBus in 01-06, not here. The alarms permission is in the 01-01
// manifest. Registering is idempotent (chrome.alarms.create with the same name
// replaces the existing alarm); failures log EVT_HANDLER and never throw
// (Golden Rule 9). Dependency-free core (Pitfall 4): no UI libs.
import { debugLog } from '@/core/error/debugLog';
import { ERROR_CODES } from '@/core/error/errorCodes';

export const KEEPALIVE_ALARM_NAME = 'nowpilot-keepalive';
const KEEPALIVE_PERIOD_MINUTES = 0.5;

export const KeepAliveManager = {
  register(): void {
    try {
      chrome.alarms.create(KEEPALIVE_ALARM_NAME, { periodInMinutes: KEEPALIVE_PERIOD_MINUTES });
    } catch (err) {
      debugLog(ERROR_CODES.EVT_HANDLER, 'keepalive alarm create failed', {
        error: err instanceof Error ? err : undefined,
        module: 'KeepAliveManager',
      });
    }
    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name !== KEEPALIVE_ALARM_NAME) return;
      debugLog(ERROR_CODES.EVT_HANDLER, 'keepalive alarm fired', {
        silent: true,
        module: 'KeepAliveManager',
      });
    });
  },
};
