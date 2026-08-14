# Electron + Nuxt Integration Guide

This document describes how the Electron desktop app integrates with the Nuxt webapp for authentication and project management.

## Overview

The Electron app opens Nuxt webapp windows for:
- Login (`/login?electron=1`)
- Signup (handled by Nuxt)
- User profile (`/user?electron=1`)
- Project management
- Observation management

The Nuxt webapp must trigger Electron IPC events at specific points to ensure proper window management and state synchronization.

---

## Required Nuxt Webapp Modifications

### 1. Detect Electron Environment

The Nuxt app should detect when it's running in Electron:

```javascript
// In your Nuxt composables or plugins
const isElectron = typeof window !== 'undefined' && window.electronAPI;
```

### 2. Login Success Event

**When:** After successful login (form submission completes successfully)

**Where:** In your login page/component after the login API call succeeds

**Action:** Trigger the `loginSuccess` IPC event

```javascript
// After successful login
if (isElectron) {
  window.electronAPI.loginSuccess(
    () => {
      // Optional: cleanup or redirect logic
      console.log('Login success acknowledged by Electron');
    },
    (error) => {
      console.error('Login success error:', error);
      // Show error to user
    }
  );
}
```

**Electron Behavior:**
- Detects auth cookie
- Extracts token from cookie
- Calls `updateAuthSession()` which:
  - Renews the cookie from token
  - Fetches user data
  - Saves token/host to encrypted files
  - Closes the login window
  - Opens createProject window if user has no projects
  - Updates context menu

---

### 3. Signup Success Event

**When:** After successful signup (form submission completes successfully)

**Where:** In your signup page/component after the signup API call succeeds

**Action:** Trigger the `signupSuccess` IPC event

```javascript
// After successful signup
if (isElectron) {
  window.electronAPI.signupSuccess(
    () => {
      // Optional: cleanup or redirect logic
      console.log('Signup success acknowledged by Electron');
    },
    (error) => {
      console.error('Signup success error:', error);
      // Show error to user
    }
  );
}
```

**Electron Behavior:**
- Same as login success (see above)
- Additionally: After `updateAuthSession()`, if user has no projects, the createProject window will open automatically

---

### 4. Window Close Behavior

**Important:** The Electron app will automatically close the login/signup window after:
1. The IPC event is triggered (`loginSuccess` or `signupSuccess`)
2. The auth cookie is detected (via polling fallback)

**Do NOT:**
- Call `window.close()` directly from Nuxt - this won't work in Electron's BrowserWindow
- Redirect to another page - let Electron handle window management

**Do:**
- Trigger the appropriate IPC event
- Let Electron handle window closing and navigation

---

### 5. Create Project Window

**When:** After login/signup, if the user has no projects

**Electron Behavior:**
- `updateAuthSession()` checks `this.user?.projectAccess.length === 0`
- If true, automatically calls `openCreateProjectWindow()`
- The create project window opens to `/projects/new?electron=1`

**Nuxt Requirement:**
- The create project page should work normally
- No special IPC events needed for this flow

---

## Fallback Behavior

The Electron app has a **polling fallback** mechanism:
- If the frontend doesn't trigger `loginSuccess` or `signupSuccess` events
- Electron polls for the auth cookie every 500ms
- When detected, it automatically proceeds with the same flow as the IPC events

**Note:** The polling fallback ensures compatibility but the IPC events are preferred for immediate response.

---

## Available Electron API Methods

The following methods are exposed to the Nuxt webapp via `window.electronAPI`:

### Authentication
- `loginSuccess(callback, callbackError)` - Signal successful login
- `signupSuccess(callback, callbackError)` - Signal successful signup

### Server Selection
- `chooseServer(body, callback, callbackError)` - Select server with `{ host: string }`
- `defaultHostValue(callback)` - Get the default host value

### Settings
- `getSettings(callback)` - Get current settings
- `getDefaultSettings(callback)` - Get default settings
- `updateSettings(settingsBody, callback, callbackError)` - Update settings

### Version
- `version(callback)` - Get Electron app version

### Observation Management
- `projectCreated(project)` - Signal project creation
- `observationCreated(project)` - Signal observation creation
- `areaMarked(...args)` - Signal area marking
- `takeAnother(observationId)` - Prepare next screenshot
- `observationImageUploaded()` - Signal observation image upload

### Client Compatibility
- `onDeprecatedClientError(callback)` - Listen for deprecated client errors

---

## URL Query Parameters

When Electron opens Nuxt windows, it adds query parameters:
- `?electron=1` - Indicates the page is opened from Electron

Use this to conditionally show/hide elements or modify behavior:

```javascript
// In Nuxt page
const route = useRoute();
const isElectron = computed(() => route.query.electron === '1');
```

---

## Testing the Integration

1. **Login Flow:**
   - Open login window from Electron
   - Submit login form
   - Verify `loginSuccess` event is triggered
   - Verify login window closes
   - Verify user is signed in

2. **Signup Flow:**
   - Open signup window from Electron
   - Submit signup form
   - Verify `signupSuccess` event is triggered
   - Verify signup window closes
   - Verify createProject window opens (if no projects)

3. **Fallback Flow:**
   - Don't trigger IPC events
   - Verify polling detects cookie after ~500ms
   - Verify same behavior as IPC events

---

## Debugging Tips

### Electron Console Output
Run with debug mode to see IPC events:
```bash
npm run start
```

Look for messages like:
- `✅ trayWindow.webContents.on('did-finish-load') triggered!`
- `Nuxt login window ready, starting cookie polling...`
- `Auth cookie detected!`
- `Login success triggered from frontend`

### Common Issues

1. **IPC events not firing:**
   - Verify `window.electronAPI` is available
   - Check preload.ts is properly loaded
   - Verify contextBridge is working

2. **Window doesn't close:**
   - Check if IPC event was triggered
   - Check if auth cookie was set
   - Check Electron console for errors

3. **Create project window doesn't open:**
   - Verify user has no projects (`user.projectAccess.length === 0`)
   - Check `updateAuthSession()` completes successfully

---

## Implementation Checklist for Nuxt

- [ ] Detect Electron environment (`window.electronAPI`)
- [ ] Trigger `loginSuccess()` after successful login
- [ ] Trigger `signupSuccess()` after successful signup
- [ ] Handle `?electron=1` query parameter
- [ ] Test login flow with Electron
- [ ] Test signup flow with Electron
- [ ] Test fallback polling behavior
