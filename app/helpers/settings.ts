import { fileExists, readFile, saveFile } from "./safeStorage";

const defaultScrollshotSettings: ScrollshotSettings = {
  rowsPrCrop: 25,
  colsPrCrop: 200,
  denoisingFactor: 0.10,
  leftCropFrom: 20,
  leftCropTo: 180,
  rightCropFrom: 20,
  rightCropTo: 200,
  matchScoreThreshold: 0.10,
};

export const defaultSettings: ISettings = {
  scrollshot: defaultScrollshotSettings,
}

const isNumber = (n: any) => typeof n === 'number' && !isNaN(n);
const isBetween = (n: number, min: number, max: number) => n > min && n < max;

const ScrollshotSettingsValidate: Record<keyof ScrollshotSettings, (val: any) => boolean> = {
  rowsPrCrop: (n) => isNumber(n) && isBetween(n, 0, 1000),
  colsPrCrop: (n) => isNumber(n) && isBetween(n, 0, 1000),
  denoisingFactor: (n) => isNumber(n) && isBetween(n, 0, 1),
  leftCropFrom: (n) => isNumber(n) && isBetween(n, 0, 1000),
  leftCropTo: (n) => isNumber(n) && isBetween(n, 0, 1000),
  rightCropFrom: (n) => isNumber(n) && isBetween(n, 0, 1000),
  rightCropTo: (n) => isNumber(n) && isBetween(n, 0, 1000),
  matchScoreThreshold: (n) => isNumber(n) && isBetween(n, 0, 1),
}


// validation function for scrollshot settings
// - returns an array of errors (if empty, then its valid)
function validateScrollshotSettings(
  settings: ScrollshotSettings
): string[] {
  // define empty error array that contains validation errors
  const errors: string[] = [];

  // loop through every setting
  for (let i = 0; i < Object.keys(settings).length; i++) {
    // retrieve the key/name for the setting
    const key = Object.keys(settings)[i] as keyof ScrollshotSettings;

    // retrieve the value
    const value = settings[key];

    // add error if value is invalid
    const valid = ScrollshotSettingsValidate[key](value);
    if (!valid) {
      errors.push(`Scrollshot setting '${key}' has an invalid value: ${value}`);
    }
  }

  // return list of errors (if empty then the validation went ok)
  return errors;
}

// validate all the settings for catching runtime errors
export function validateSettings(
  settings: ISettings
): string[] {
  const errors: string[] = []
  const scrollshotErrors = validateScrollshotSettings(settings.scrollshot);
  if (scrollshotErrors.length > 0) {
    errors.push(...scrollshotErrors);
  }

  return errors;
}

export function initializeSettings(
  filePath: string
): ISettings {
  const settingsFromFile = loadSettingsFromFile(filePath);
  if (settingsFromFile) {
    return settingsFromFile;
  } else {
    return defaultSettings;
  }
}

function loadSettingsFromFile(
  filePath: string
): ISettings | null {
  // if file does not exist, return already
  if (!fileExists(filePath)) {
    return null;
  }

  const content = readFile(filePath);
  try {
    // parse file contents to JSON
    const parsed = JSON.parse(content);

    // throw if any validation errors
    const errors = validateSettings(parsed);
    if (errors.length > 0) {
      throw new Error(errors.join(';'));
    }

    // return settings decrypted from file
    return parsed;

  } catch(e) {
    // TODO: report silently
    console.warn('parsing of file FAILED - will return default settings:')
    console.warn(e);
  }
  return null;
}

// save settings to file
export function saveSettingsToFile(
  filePath: string,
  settings: ISettings,
): void {
  saveFile(JSON.stringify(settings), filePath);
}