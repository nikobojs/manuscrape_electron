<br />

<a href="https://github.com/nikobojs/manuscrape_electron">
<picture>
  <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/nikobojs/manuscrape_nuxt/stable/public/logo/manuscrape-logo-dark.svg">
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/nikobojs/manuscrape_nuxt/stable/public/logo/manuscrape-logo-light.svg">
  <img width="250" alt="Manuscape logo" src="https://raw.githubusercontent.com/nikobojs/manuscrape_nuxt/stable/public/logo/manuscrape-logo-light.svg">
</picture>
</a>
<br />
<br />
ManuScrape is a solution for managing large amounts of observations (images mapped to custom defined parameters), including tools to collect, edit, enrich and export.
<br />
<br />

# ManuScrape Windows App

This is the main ManuScrape repo which holds the native client side windows app and installation guide. <br />

> If you are looking for the backend repo, go to the [manuscrape_nuxt repository](https://github.com/nikobojs/manuscrape_nuxt).

<br />
<br />

## Basic feature overview:

There are two main actors: the _project manager_ and the _collaborator_.
<br />
<br />

_Project managers_ can setup projects using the web app:

1. Enter project name
2. Define observation parameters
3. Invite collaborators by email

_Collaborators_ can submit observations using the native app:

1. Capture image (using smart tools or file upload)
2. Edit image
3. Enter observation parameter values
4. Attach extra files if any
5. Submit observation

Whether you're a collaborator or project owner isn't bound to your ManuScrape user, but to your permission role in the specific project.

The _project manager_ can export the entire project into to different formats, including spreadsheets and zip files. Right now the export features are optimized to deliver formats, that are easy to import into [NVivo 14](https://lumivero.com/products/nvivo/).
<br />
<br />

## Installation on Windows

Before you start installing, you need to decide where you want to put your data. As of now, you can temporarily use [app.manuscrape.org](https://app.manuscrape.org) for free, which is also the default option in the signup flow.

You can also use another instance of the manuscrape backend, either by a third party provider, or in your own organization. You choose which backend to use, by specifying the URL in the sign-up and sign-in flow.

You can download a windows installer, that will either install or update the ManuScrape client to the desired version. The latest .exe installer can be found [here](https://github.com/nikobojs/manuscrape_electron/releases).
<br />
<br />

## Bug reports / Feature requests

We intend to use GitHub Issues for all development tasks. If you experience bugs, or need features added or refactored, please [submit an issue](https://github.com/nikobojs/manuscrape_electron/issues), preferably in english.
<br />
<br />

## Contribute to the code ☕

You are more than welcome to contribute to the project in any way. Except donations. For now.<br />

#### Repository overview:

This repo is an Electron app tested on Windows 11 and a couple Linux distributions. The app provides native client tools, that talks with the api of the Nuxt app. [Here is the Nuxt repo](https://github.com/nikobojs/manuscrape_nuxt).
<br />

#### Git conventions:

Make your contributions the way you think works best. Please branch out from the branch named "unstable", which contains the newest version.<br />

<br />
<br />

#### Setup development environment:

These instructions covers installation of a completely local setup, on all three major platforms. However, on Windows, the npm scripts will only work on Git Bash.<br />

1. Install Python and NodeJS (and Git Bash on Windows)
2. Install Electron repository:
   1. `git clone https://github.com/nikobojs/manuscrape_electron`
   2. `cd manuscrape_electron`
   3. `npm install`
   4. `npm run pyinstall` (on Windows: `npm run pyinstall-win`)
   5. `npm run pyfreeze` (on Windows: `npm run pyfreeze-win`)
3. [Install ManuScrape Nuxt repository](https://github.com/nikobojs/manuscrape_nuxt)
4. Start Nuxt app: `cd manuscrape_nuxt && yarn dev`
5. Start Electron app: `cd manuscrape_electron && npm start`
6. For MacOS: If you have problems with taking screenshots after the installation, go to System Preferences -> Privacy & Security -> Screen Recording, and give app permission

<br />
<br />

## Contributors 💥 🚀 😻

- [@FAF2205](https://github.com/FAF2205)
- [@Mod-lab-stoff](https://github.com/Mod-lab-stoff)
- [@Pallisgaard](https://github.com/Pallisaard)
- [@Pedrotheplant](https://github.com/Pedrotheplant)
- [@SEilertsen](https://github.com/SEilertsen)
- [@bjarke22](https://github.com/bjarke22)
- [@jakobdemant](https://github.com/jakobdemant)
- [@kdath](https://github.com/kdath)
- [@nabojens](https://github.com/nabojens)
- [@nikobojs](https://github.com/nikobojs)
- [@samuelhimmelstrup](https://github.com/samuelhimmelstrup)
