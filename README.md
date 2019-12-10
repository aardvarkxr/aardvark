# What is Aardvark?

Aardvark is a framework for building augmented reality "gadgets" that run on top of virtual reality experiences. 
Gadgets are constructed using a bunch of custom React components (from the [@aardvarkxr/aardvark-react](https://www.npmjs.com/package/@aardvarkxr/aardvark-react) package) and run in the Aardvark application.
Gadgets use these components to show interactive models, 2D UI, or other stuff that will draw on top of any VR applications you run.
You can attach these gadgets to your hands and bring them with you in your favorite VR apps.

# Project Status and Road Map

## Current Status

Aardvark is more or less a prototype at the moment.
The interfaces are still in flux, many necessary features are missing, and the user interface still needs a lot of work.
We're putting this out there now to gather as much feedback from people as possible and let users and developers shape the future direction of the project. 
[Join the slack](https://join.slack.com/t/aardvarkxr/shared_invite/enQtODU1MTM3NjI5OTg3LTM0MGI4NzRjZDBjYTJjN2E1ZWIxNjU5MzdmNWZjMWVmM2UzMWE4MWZhOWY1YzI2MDMzZDNmZjhhNzViY2YxYWU) and tell us what you think.
Or file an issue or pull request if you find something that could be better. 
We want to hear from you.

Aardvark is not far enough along for you to use it in any kind of production project.
Expect future releases to break compatibility with existing gadgets.

## Upcoming Features

Here's a short list of things that we'd like to add or work on in no particular order:

* Multiple panels in each gadget, probably through popups
* Panels for desktop applications #38
* Animation to smooth  out transitions and just generally make things nicer
* Switch to using a more capable rendering engine #11
* Figure out better ways of not conflicting with the input of the host games
* Provide better ways to let users find and use gadgets
* Networked gadget scene graphs, including panels
* Knowledge of where the user is in the VR experiences themselves so gadgets can be responsive to that

If you want to help out with any of these, please reach out.

# Who is building this thing?

There are a few of us working on it.
Look at the commits to see a list of active participants.

Most of us work at companies that are involved in the VR space.
Aardvark is not associated with any of those companies.

# Getting Started

## Use a released build

If you just want to make gadgets, your best bet is to use a <a href="https://github.com/JoeLudwig/aardvark/releases">released build</a>.
Just download the latest release, unzip it, and run avrenderer.exe.

If you need to do any development work from the source, you may want to run a local build following the instructions below.


## Building Locally

All of this has been tested on Windows 10 with VS2017.
Other platforms (including other versions of Windows) and other compilers are left as an exercise to the reader.)

Follow these steps:

1. Open a command prompt to your cloned repro directory. I'll call that d:\aardvark below, but it can be wherever you like.
2. Build web code
   1. cd d:\aardvark\websrc
   2. npm install
   3. npm run build
3. Unzip CEF libs (These are over the 100MB Github file size limit when unzipped)
   1. unzip d:\aardvark\src\thirdparty\cef_binary_78\Debug\libcef.gz
   2. unzip d:\aardvark\src\thirdparty\cef_binary_78\Debug\cef_sandbox.gz
   3. unzip d:\aardvark\src\thirdparty\cef_binary_78\Release\libcef.gz
4. Build aardvark C++ code
   1. cd d:\aardvark\src
   2. mkdir build
   3. cd build
   4. cmake -G "Visual Studio 15 2017 Win64" .. 
   5. Open Aardvark.sln 
   6. Build in debug
5. Make symlinks from the Aardvark build to the data directory
   1. Open an administrator command prompt
   2. cd to d:\aardvark\src
   3. makelinks.bat build
6. Run it!
   1. Open a command prompt in d:\aardvark\data and run "node server\server_bundle.js"
   1. Pick "avrenderer" as the startup project in visual studio
   2. Start Debugging from the Debug menu

## Installing useful tools

	npm install -g @aardvarkxr/aardvark-cli

This will install "avcmd" globally, and in your path. You can do several useful things with this command. 

**avcmd install <path or url>**

Adds the gadget at the path or URL to the control panel that appears under the gear icon.
Make sure <path>/gadget_manifest.json or <url>/gadget_manifest.json is valid otherwise things will break when you create the gadget.

You will need to restart avrenderer (including the server if you're running that on its own) to see the change.


**avcmd uninstall <path or url>**

Removes the gadget from the control panel.

You will need to restart avrenderer (including the server if you're running that on its own) to see the change.


**avcmd list**

Lists the gadgets that are currently installed.


**avcmd reset**

Resets the gadget list to the default examples.


## Making your first gadget

CD to an empty directory and type:
	npm init @aardvarkxr

This will install the @aardvarkxr/create script and then run it.
Answer the prompts to set up your gadget.

Then run:

	npm install
	npm run build

After that you probably want to install your gadget with:
	avcmd install dist


You can open your gadget directory in Visual Studio Code to aid in react/aardvark development.


## Debugging

You can use chrome dev tools on your gadgets by browsing to <a href="http://localhost:8042/">http://localhost:8042/</a> while Aardvark is running.

You can see the active scene graphs of all gadgets with the monitor.
You can find it in aardvark/data/gadgets/aardvark_monitor/index.html; just open that in your browser and will connect to the server on localhost.

If you want to run the server outside of avrenderer, you can do so. Just run it from the root Aardvark directory (i.e. the one that contains data). If you want to work on the server scripts themselves, you can run "nodemon --inspect data\server\server_bundle.js" to enable attaching the debugger and auto-restarts when the server bundle changes.


