# ManuScrape Native
ManuScrape is a solution for managing large amounts of observations (images mapped to custom defined project parameters), including tools to collect, edit, enrich and export. There are two actors: the project manager, and the collaborator (can only submit observations). This is the general idea:

Project manager (using web app):
```mermaid
graph LR
B(Create project) --> C(Setup project parameters) --> D(Invite colleborators)
```

Collaborator (using native app):
```mermaid
graph LR
B(Capture image) --> C(Edit image) --> D(Enter parameter values) --> E(Attach files) --> F(Submit observation)
```

## Installation on Windows
Before you start installing, you need to decide where you want to put your data. As of now you can temporarily use [manuscrape.org](https://manuscrape.org) for free, and it is also the default in the signup flow.

You can download a compiled windows installer, that will either install or update ManuScrape to the desired version. The latest .exe installer can be found [here](https://github.com/nikobojs/manuscrape_electron/releases).
<br />
<br />

## Features

_Video introduction will maybe come out soon!_
<br />
<br />

## Bug reports / feature requests
After the launch of v1.0.0, we intend to use GitHub Issues for all development tasks. If you experience bugs or need features added or refactored, please [submit an issue](https://github.com/nikobojs/manuscrape_electron/issues), preferably in english.
<br />
<br />

## Development

#### Repository overview:
This repo is an Electron app tested continuously on Windows 11 and a couple Linux distributions. The app provides some client-side native tools that talks with the api of the online backend app. [Here is the backend repo](https://github.com/nikobojs/manuscrape_nuxt). These to repositories follows compatability with git tags (eg. `v0.9.2` client works with `v0.9.2` api).

#### Get started on Linux or Mac:
1. Install Electron repository:
	1. `git clone https://github.com/nikobojs/manuscrape_electron`
	2. `cd manuscrape_electron`
	3. `npm install`
	4. `npm pyinstall`
	5. `npm pyfreeze`
2. [Install ManuScrape Nuxt repository](https://github.com/nikobojs/manuscrape_nuxt)
3. Setup PostgreSQL database
4. Verify environment variables on both repositories
5. Start Nuxt app: `cd manuscrape_nuxt && yarn dev`
6. Start Electron app: `cd manuscrape_electron && npm start`

#### Git conventions
Not strict in any way. We'll always figure it out so you do stuff the way you think it works best. However pull requests (into "unstable" branch) on feature branches is preferred.