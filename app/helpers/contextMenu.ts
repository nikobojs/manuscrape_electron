import { app, MenuItem, shell, screen, Menu } from "electron";
import path from "path";
import type { ManuScrapeController } from "../controller";
import {
  loginIcon,
  addIcon,
  monitorIcon,
  logoutIcon,
  bugReportIcon,
  quitIcon,
  folderIcon,
  openInNewIcon,
  settingsIcon,
} from "./icons";

function getAndroidSetupGuidePath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, "guides", "android-setup.pdf")
    : path.join(
        app.getAppPath(),
        "assets",
        "guides",
        "android-setup.pdf",
      );
}

export function generateMenuItems(
  controller: ManuScrapeController,
  user: IUser | undefined,
): MenuItem[] {
  const menuItems = [] as MenuItem[];
  const activeDisplay = controller.getActiveDisplay();
  const projectAccess = controller.getActiveProject();

  if (!user) {
    menuItems.push(
      new MenuItem({
        type: "normal",
        label: "Sign in",
        click: () => {
          controller.openAuthorizationWindow();
        },
        icon: loginIcon,
      }),
    );
    menuItems.push(
      new MenuItem({
        type: "normal",
        label: "Create account",
        click: () => {
          controller.openAuthorizationWindow(true);
        },
        icon: loginIcon,
      }),
    );
  } else if (controller.isMarkingArea) {
    menuItems.push(
      new MenuItem({
        type: "normal",
        label: "Overlay is currently open",
        enabled: false,
      }),
    );
    menuItems.push(
      new MenuItem({
        type: "normal",
        label: "Cancel action",
        click: () => {
          controller.cancelOverlay();
        },
        accelerator: "Alt+C",
      }),
    );
  } else if (user) {
    if (user.projectAccess?.length == 0) {
      menuItems.push(
        new MenuItem({
          label: "Create first project",
          type: "normal",
          click: () => {
            controller.openCreateProjectWindow();
          },
          icon: addIcon,
        }),
      );
    } else if (projectAccess) {
      if (controller.activeObservationId) {
        menuItems.push(
          new MenuItem({
            label: "Modifying exiting observation",
            type: "header",
            enabled: false,
          }),
          new MenuItem({
            label: "Cancel focus on observation",
            type: "normal",
            click: () => controller.cancelActiveObservation(),
            icon: quitIcon,
          }),
          new MenuItem({
            type: "separator",
          }),
        );
      }

      // use `hasImageField` boolean to enable/disable helper text + take screenshot + take scrollshot
      let hasImageField = false;
      if (projectAccess) {
        hasImageField = !!projectAccess.project.fields
          .map((f) => f.type)
          .find((t) => t.includes("IMAGE"));
      }

      if (!hasImageField) {
        menuItems.push(
          new MenuItem({
            label: "Project has no image field(s)",
            type: "header",
            enabled: false,
          }),
        );
      }
      menuItems.push(
        new MenuItem({
          label: "Take screenshot",
          type: "normal",
          enabled: hasImageField,
          click: () => controller.createQuickScreenshot(),
          accelerator: "Alt+N",
          icon: addIcon,
        }),
      );

      menuItems.push(
        new MenuItem({
          label: "Take scrollshot",
          type: "normal",
          enabled: hasImageField,
          click: () => controller.createScrollScreenshot(),
          accelerator: "Alt+S",
          icon: addIcon,
        }),
      );

      menuItems.push(
        new MenuItem({
          label: "Create empty draft",
          type: "normal",
          click: () => controller.openEmptyDraftWindow(),
          icon: addIcon,
        }),
      );

      menuItems.push(
        new MenuItem({
          label: "Open drafts",
          type: "normal",
          click: () => controller.openObservationDraftsWindow(),
          icon: openInNewIcon,
        }),
      );
    }
  }

  // add nice seperator (dynamic stuff above seperator, always-there stuff in the bottom)
  menuItems.push(
    new MenuItem({
      type: "separator",
    }),
  );

  if (user) {
    // create new empty screens submenu
    const screenMenu = new MenuItem({
      label: "Choose monitor",
      sublabel: activeDisplay?.label,
      submenu: [],
      type: "submenu",
      icon: monitorIcon,
    });

    // update screens available
    controller.allDisplays = screen.getAllDisplays();

    // add all screens to submenu
    for (let i = 0; i < controller.allDisplays.length; i++) {
      const display = controller.allDisplays[i];

      // create screen submenu item
      const screenMenuItem = new MenuItem({
        label: display?.label || `Screen #${display.id}`,
        id: display.id.toString(),
        type: "radio",
        checked: display.id == activeDisplay.id,
        enabled: !controller.isMarkingArea,
        click: () => controller.useDisplay(i),
      });

      // add screen to submenu
      screenMenu.submenu?.insert(i, screenMenuItem);
    }

    // TODO: refactor function and improve readability
    if (user.projectAccess?.length > 0) {
      // add projects to menuItems
      const projectMenu = new MenuItem({
        label: "Choose project",
        submenu: [],
        type: "submenu",
        icon: folderIcon,
        sublabel: "",
      });

      if (user.projectAccess.length > 0) {
        for (let i = 0; i < user.projectAccess.length; i++) {
          const project = user.projectAccess[i].project;
          projectMenu.submenu?.insert(
            i,
            new MenuItem({
              id: project.id.toString(),
              label: project.name,
              type: "radio",
              checked: false,
              click: () => controller.chooseProject(project.id),
            }),
          );
        }
      }

      const chosenMenuItem = projectMenu.submenu?.items.find(
        (item) => item.id === controller.activeProjectId?.toString(),
      );

      const activeProjectAccess = user.projectAccess.find(
        (p) => p.project.id === controller.activeProjectId,
      );

      if (activeProjectAccess) {
        projectMenu.sublabel = activeProjectAccess.project.name;
      }

      if (chosenMenuItem) {
        chosenMenuItem.checked = true;
      } else {
        controller.chooseProject(user.projectAccess[0].project.id);
        projectMenu.sublabel = user.projectAccess[0].project.name;
      }

      projectMenu.submenu?.append(
        new MenuItem({
          type: "separator",
        }),
      );
      projectMenu.submenu?.append(
        new MenuItem({
          label: "Create project",
          type: "normal",
          click: () => {
            controller.openCreateProjectWindow();
          },
          icon: addIcon,
        }),
      );

      menuItems.push(projectMenu);
    }

    // ==========================================
    // DYNAMIC "PHONES" SUBMENU
    // ==========================================
    const connectedDevices = controller.getConnectedDevices();
    const phoneSubmenuItems = [] as MenuItem[];
    const readyDevices = connectedDevices.filter(
      (device) => device.status === "device",
    );
    const unavailableDevices = connectedDevices.filter(
      (device) => device.status !== "device",
    );

    if (connectedDevices.length === 0) {
      phoneSubmenuItems.push(
        new MenuItem({
          label: "No phones found",
          enabled: false,
        }),
      );
    }

    readyDevices.forEach((device) => {
      phoneSubmenuItems.push(
        new MenuItem({
          label: `📱 ${device.model} (${device.serial})`,
          click: () => controller.startScrcpy(device.serial),
        }),
      );
    });

    unavailableDevices.forEach((device) => {
      const statusMessage =
        device.status === "unauthorized" ? "Unauthorized" : "Offline";

      phoneSubmenuItems.push(
        new MenuItem({
          label: `⚠️ ${device.serial}: ${statusMessage} — follow the setup guide`,
          enabled: false,
        }),
      );
    });

    phoneSubmenuItems.push(
      new MenuItem({
        type: "separator",
      }),
    );
    phoneSubmenuItems.push(
      new MenuItem({
        label: "Set up Android phone",
        icon: openInNewIcon,
        click: () => {
          shell.openPath(getAndroidSetupGuidePath()).then((errorMessage) => {
            if (errorMessage) {
              console.error(
                "Could not open the Android setup guide:",
                errorMessage,
              );
            }
          });
        },
      }),
    );

    const phoneMenu = new MenuItem({
      label: "Phones",
      submenu: Menu.buildFromTemplate(phoneSubmenuItems),
      type: "submenu",
      icon: monitorIcon, // You can change the icon later if needed
    });

    // add menu to menuItems
    menuItems.push(screenMenu);
    menuItems.push(phoneMenu);

    // add nice seperator (dynamic stuff above seperator, always-there stuff in the bottom)
    menuItems.push(
      new MenuItem({
        type: "separator",
      }),
    );

    // open settings window
    menuItems.push(
      new MenuItem({
        label: "Settings",
        type: "normal",
        click: () => controller.openSettingsWindow(),
        icon: settingsIcon,
      }),
    );

    menuItems.push(
      new MenuItem({
        label: "Log out",
        type: "normal",
        click: () => controller.logOut(),
        icon: logoutIcon,
      }),
    );

    menuItems.push(
      new MenuItem({
        label: "Report issue",
        type: "normal",
        click: () =>
          shell.openExternal(
            "https://github.com/nikobojs/manuscrape_electron/issues",
          ),
        icon: bugReportIcon,
      }),
    );
  }

  // exit context menu item
  const itemExit = new MenuItem({
    label: "Quit",
    enabled: !controller.isMarkingArea,
    icon: quitIcon,
    click: () => app.exit(0),
  });

  // add all menu items
  menuItems.push(itemExit);

  return menuItems;
}

export function generateContextMenu(
  controller: ManuScrapeController,
  user: IUser | undefined,
) {
  const menuItems = generateMenuItems(controller, user);
  const menu = Menu.buildFromTemplate(menuItems);
  return menu;
}
