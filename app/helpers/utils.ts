import {
  type MessageBoxOptions,
  dialog,
  safeStorage,
  Notification,
  systemPreferences,
} from 'electron';
import { warningIcon } from './icons';

export function sleepAsync(ms: number | undefined) {
  return new Promise((ok) => setTimeout(ok, ms));
}

export function warnIfEncryptionUnavailable(): boolean {
  const encryptionAvailable = safeStorage.isEncryptionAvailable();
  if (!encryptionAvailable) {
    const err = new Error(
      'Your machine does not support safe login. Your login sessions will not be saved'
    );
    new Notification({
      title: 'ManuScrape',
      body: err.message,
      icon: warningIcon,
    }).show();
  }
  return encryptionAvailable;
}

export function yesOrNo(message: string): boolean {
  const options: MessageBoxOptions = {
    title: 'Awaiting your confirmation',
    buttons: ['&Yes', '&No', '&Cancel'],
    message,
    type: 'warning',
    normalizeAccessKeys: true,
    cancelId: 2,
  };

  const response = dialog.showMessageBoxSync(options);

  return response == 0; // Yes button is pressed
}

export function selectProjectField(message: string, projectFields: SmallProjectFieldResponse[]): SmallProjectFieldResponse | null {
  const buttons = projectFields.map(pf => `&Select "${pf?.label || 'Unknown label'}"`).concat(['Cancel']);
  const options: MessageBoxOptions = {
    title: 'Select project parameter',
    buttons,
    message,
    type: 'warning',
    normalizeAccessKeys: true,
    cancelId: 2,
  };

  const response = dialog.showMessageBoxSync(options);
  return response == buttons.length - 1 ? null : projectFields[response];
}

// This is important for macOS 10.15 Catalina or higher, but crashes Linux
export function warnIfScreenIsNotAccessible(): boolean {
  const isMacOrWindows = ['darwin', 'win32'].includes(process.platform);
  if (!isMacOrWindows) return true;
  const screenAccessGranted = systemPreferences.getMediaAccessStatus('screen');
  const isScreenAccessible = screenAccessGranted === 'granted';

  if (!isScreenAccessible) {
    const err = new Error(
      'Go to System Preferences and give app screen recording permission'
    );
    new Notification({
      title: 'ManuScrape',
      body: err.message,
      icon: warningIcon,
    }).show();
  }

  return isScreenAccessible;
}

const SquirrelEvents: SquirrelEvent[] = ['install', 'uninstall', 'firstrun'];

// return squirrel argument string if it could be detected and parsed in `_args`
export function parseSquirrelArgs(_args: string[]): SquirrelEvent | undefined {
  // set `args` to `_args` except the first entry
  const args: string[] = _args.filter((_, i) => i > 0);
  let squirrelEvent: SquirrelEvent | undefined = undefined;

  // iterate through all args and look for "--squirrel-"
  for (const arg of args) {
    if (arg.includes('--squirrel-')) {
      const candidateEvent = arg.replace('--squirrel-', '');
      // if argument string is in `SquirrelEvents`, break loop and return the argument string
      if (SquirrelEvents.includes(candidateEvent as SquirrelEvent)) {
        squirrelEvent = candidateEvent as SquirrelEvent;
        break;
      } else {
        console.warn('Unhandled squirrel event:', candidateEvent);
      }
    }
  }
  return squirrelEvent;
}
