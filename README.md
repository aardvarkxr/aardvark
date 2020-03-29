# What is Aardvark?

Aardvark is a framework for building augmented reality "gadgets" that run on top of virtual reality experiences. 
Gadgets are constructed using a bunch of custom React components (from the [@aardvarkxr/aardvark-react](https://www.npmjs.com/package/@aardvarkxr/aardvark-react) package) and run in the Aardvark application.
Gadgets use these components to show interactive models, 2D UI, or other stuff that will draw on top of any VR applications you run.
You can attach these gadgets to your hands and bring them with you in your favorite VR apps.

[![A short introduction to Aardvark](http://img.youtube.com/vi/pux6RbySUMU/0.jpg)](http://www.youtube.com/watch?v=pux6RbySUMU "A short introduction to Aardvark")

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
You may need to start SteamVR before you start avrenderer.exe.

You can find more documentation on how to build gadgets [here](https://aardvarkxr.github.io/aardvark/).

If you need to do any development work from the source, you can also [build from the source](#building-the-aardvark-browser).

## How to use Aardvark

Aardvark is made up of "gadgets". 
These are 3D objects that do something useful (or are maybe just decorative.) 
You can install any number of gadgets in the Aardvark browser and then use them in any SteamVR application.

The main thing you can do with a gadget is touch it with the controller and pull the trigger to grab it. 
For example, here we are grabbing the gadget control panel:

![Grabbing the gadget controls](https://aardvarkxr.github.io/aardvark/images/grab_gadget_controls.webp)

You can see that the controls expand to show more information when they're grabbed.
Exactly what is shown in each state will vary from gadget to gadget, but this is pretty common.
While holding a gadget, it may also support various operations with the A and B buttons, or by squeezing the grip. 
Exactly what those buttons do will also vary from gadget to gadget.

It also returns to the place where it was picked up whenever the trigger is released. 
If you want to move a gadget from one place to another, you can press the trackpad (on Knuckles. Press up on the thumbstick on Oculus Touch.)
This will untether the gadget from its starting point.
Dropping most untethered gadgets in the world will throw them away.

Using these basic controls, you can create any of the gadgets in the menu. 

![Grabbing the gadget controls](https://aardvarkxr.github.io/aardvark/images/create_gadget_from_menu.webp)

This test panel gadget shrinks in size when it is close to something it can attach to.
It also supports the fine kind of interaction: clicking. 
Any panel that supports clicking will show a line highlighting the click location when a hand gets close to it.

At the moment, all the button presses you make in Aardvark will also be passed to the underlying application. 
That is still a work in progress.

# Building the Aardvark Browser

All of this has been tested on Windows 10 with VS2019.
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
   4. cmake -G "Visual Studio 16 2019" -A x64 .. 
      * VS 2017 will probably still work too: cmake -G "Visual Studio 15 2017 Win64" .. 
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


