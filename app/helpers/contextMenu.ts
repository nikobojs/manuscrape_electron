import { MenuItem, shell, screen, Menu } from "electron";
import type { ManuScrapeController } from "../controller";
import { loginIcon, addIcon, monitorIcon, logoutIcon, bugReportIcon, quitIcon, folderIcon, openInNewIcon, settingsIcon } from "./icons";

export function generateMenuItems(
  controller: ManuScrapeController,
  user: IUser | undefined,
): MenuItem[] {
    const menuItems = [] as MenuItem[];
    const activeDisplay = controller.getActiveDisplay();

    if (!user) {
      menuItems.push(new MenuItem({
        type: 'normal',
        label: 'Sign in',
        click: () => {
          controller.openAuthorizationWindow();
        },
        icon: loginIcon,
      }))
      menuItems.push(new MenuItem({
        type: 'normal',
        label: 'Create account',
        click: () => {
          controller.openAuthorizationWindow(true);
        },
        icon: loginIcon,
      }))
    } else if (controller.isMarkingArea) {
      menuItems.push(new MenuItem({
        type: 'normal',
        label: 'Overlay is currently open',
        enabled: false,
      }))
      menuItems.push(new MenuItem({
        type: 'normal',
        label: 'Cancel action',
        click: () => {
          controller.cancelOverlay();
        },
        accelerator: 'Alt+C',
      }))
    } else if(user) {
      if (user.projectAccess?.length == 0) {
        menuItems.push(new MenuItem({
          label: "Create first project",
          type: "normal",
          click: () => {
            controller.openCreateProjectWindow()
          },
          icon: addIcon,
        }));
      } else {
        menuItems.push(new MenuItem({
          label: "Take screenshot",
          type: "normal",
          click: () => controller.createQuickScreenshot(),
          accelerator: 'Alt+N',
          icon: addIcon,
        }));

        menuItems.push(new MenuItem({
          label: "Take scrollshot",
          type: "normal",
          click: () => controller.createScrollScreenshot(),
          accelerator: 'Alt+S',
          icon: addIcon,
        }));

        menuItems.push(new MenuItem({
          label: "Create empty draft",
          type: "normal",
          click: () => controller.openEmptyDraftWindow(),
          icon: addIcon,
        }));

        menuItems.push(new MenuItem({
          label: "Open drafts",
          type: "normal",
          click: () => controller.openObservationDraftsWindow(),
          icon: openInNewIcon,
        }));
      }
    }


    // add nice seperator (dynamic stuff above seperator, always-there stuff in the bottom)
    menuItems.push(new MenuItem({
      type: 'separator',      
    }));

    if (user) {

      // create new empty screens submenu
      const screenMenu = new MenuItem({
        label: "Choose monitor",
        sublabel: activeDisplay.label,
        submenu: [],
        type: 'submenu',
        icon: monitorIcon,
      });

      // update screens available
      controller.allDisplays = screen.getAllDisplays();

      // add all screens to submenu
      for (let i = 0; i < controller.allDisplays.length; i++) {
        const display = controller.allDisplays[i];

        // create screen submenu item
        const screenMenuItem = new MenuItem({
          label: display.label,
          id: display.id.toString(),
          type: 'radio',
          checked: display.id == activeDisplay.id,
          enabled: !controller.isMarkingArea,
          click: () => controller.useDisplay(i),
        })

        // add screen to submenu
        screenMenu.submenu?.insert(i, screenMenuItem)
      }

      // TODO: refactor function and improve readability
      if (user.projectAccess?.length > 0) {
        // add projects to menuItems
        const projectMenu = new MenuItem({
          label: "Choose project",
          submenu: [],
          type: 'submenu',
          icon: folderIcon,
          sublabel: '',
        })
        
        if (user.projectAccess.length > 0) {
          for (let i = 0; i < user.projectAccess.length; i++) {
            const project = user.projectAccess[i].project;
            projectMenu.submenu?.insert(i, new MenuItem({
              id: project.id.toString(),
              label: project.name,
              type: 'radio',
              checked: false,
              click: () => controller.chooseProject(project.id),
            }));
          }
        }

        const chosenMenuItem = projectMenu.submenu?.items.find((item) =>
          item.id === controller.activeProjectId?.toString()
        );

        const activeProjectAccess = user.projectAccess.find(
          (p) => p.project.id === controller.activeProjectId
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

        projectMenu.submenu?.append(new MenuItem({
          type: 'separator'
        }))
        projectMenu.submenu?.append(new MenuItem({
          label: "Create project",
          type: "normal",
          click: () => {
            controller.openCreateProjectWindow()
          },
          icon: addIcon,
        }));

        menuItems.push(projectMenu);
      }

      // add menu to menuItems
      menuItems.push(screenMenu);

      // add nice seperator (dynamic stuff above seperator, always-there stuff in the bottom)
      menuItems.push(new MenuItem({
        type: 'separator',      
      }));

      // open settings window
      menuItems.push(new MenuItem({
        label: "Settings",
        type: "normal",
        click: () => controller.openSettingsWindow(),
        icon: settingsIcon,
      }));

      menuItems.push(new MenuItem({
        label: "Log out",
        type: "normal",
        click: () => controller.logOut(),
        icon: logoutIcon,
      }));

      menuItems.push(new MenuItem({
        label: "Report issue",
        type: "normal",
        click: () => shell.openExternal('https://github.com/nikobojs/manuscrape_electron/issues'),
        icon: bugReportIcon,
      }));

    }

    // exit context menu item
    const itemExit = new MenuItem({
      label: "Quit",
      enabled: !controller.isMarkingArea,
      role: "quit",
      icon: quitIcon,
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
