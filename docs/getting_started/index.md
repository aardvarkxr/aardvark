---
title: Getting started with Aardvark
---
# Building your first Aardvark gadget

This is a simple step by step guide to building your first Aardvark gadget.
Assuming you have the pre-requisites installed already, this will take about ten minutes.

This guide uses Typescript, Visual Studio Code, and npm.
Using Javascript to build your gadget should be straightforward... just use .js files below instead of .ts files and omit the type declarations.

# Step 0 - Pre-requisites

There are some pre-requisites to following the rest of this guide.
Specifically you need to have the following applications installed:
* (Visual Studio Code)[https://code.visualstudio.com/download)
* (npm)[https://www.npmjs.com/get-npm]
* typescript - Once npm is installed, you can install typescript with `npm install -g typescript`
* avcmd - This is a command line tool for Aardvark developers. Once npm is installed, you can install it with `npm install -g @aardvarkxr/aardvark-cli`.

There's nothing in the instructions below that cares what platform you're running on, but these instructions have only been tested on Windows 10.
Aardvark itself also currently only runs on Windows.

# Step 1 - Initialize an empty gadget

The Aardvark init tool will help you create a mostly-blank project in the current directory.

```console
E:\gettingstarted>npm init @aardvarkxr
Aardvark gadget project create script (0.4.0)
? What is the package name to use for your gadget? mygadget
? What is the package name to use for your gadget? mygadget
? What is the user-facing name of your gadget? My Awesome Gadget
? What is the user-facing name of your gadget? My Awesome Gadget
? Does your gadget use panels (i.e. 2D quads in the world)? (Y/n)
? Does your gadget use panels (i.e. 2D quads in the world)? Yes
? Texture width (1024)
? Texture width 1024
? Texture height (1024)
? Texture height 1024
? Does your gadget start other gadgets? (y/N)
? Does your gadget start other gadgets? No
? Does your gadget join multi-user chambers? (y/N)
? Does your gadget join multi-user chambers? No
? Do you want to debug with VS Code? (Y/n)
? Do you want to debug with VS Code? Yes
Your answers:  {
  packageName: 'mygadget',
  gadgetName: 'My Awesome Gadget',
  usesPanels: true,
  width: 1024,
  height: 1024,
  startsGadgets: false,
  joinsChambers: false,
  wantsVSCode: true
}
Using @aardvarkxr/aardvark-react@^0.4.0 and @aardvarkxr/aardvark-shared@^0.4.0
Created ./src
Added gadget_manifest.json
Added tsconfig.json
Added package.json
Added src/styles.css
Added src/main.tsx
Added src/index.html
Created ./src/models
Added src/models/placeholder.glb
Added webpack.config.js
Created ./.vscode
Added .vscode/launch.json
```

This results in the following files:
```
E:\GETTINGSTARTED
|   package.json
|   tsconfig.json
|   webpack.config.js
|
+---.vscode
|       launch.json
|
\---src
    |   gadget_manifest.json
    |   index.html
    |   main.tsx
    |   styles.css
    |
    \---models
            placeholder.glb
```

Now that you have a gadget project, open it in Visual Studio code.

```console
E:\gettingstarted> code .
```

