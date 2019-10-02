**Aardvark is not ready**

Aardvark is not far enough along for you to use it in any kind of production project.
This release is intended to gather feedback and foster further development, but there is still a ways to go before the API is stable.
Expect future releases to break compatibility with existing gadgets.

**How To Build**

All of this has been tested on Windows 10 with VS2017.
Other platforms (including other versions of Windows) and other compilers are left as an exercise to the reader.)
This has also only been tested in debug.


1. Open a command prompt to your cloned repro directory. I'll call that d:\aardvark below, but it can be wherever you like.
2. Build web code
   1. cd d:\aardvark\websrc
   2. npm install
   3. npm run-script build
3. Unzip CEF libs (These are over the 100MB Github file size limit when unzipped)
   1. unzip d:\aardvark\src\thirdparty\cefbinary_72\Debug\libcef.zip
   2. unzip d:\aardvark\src\thirdparty\cefbinary_72\Debug\cef_sandbox.zip
   3. unzip d:\aardvark\src\thirdparty\cefbinary_72\Release\libcef.zip
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

**Debugging web stuff**

You can use chrome dev tools on your gadgets by browsing to <a href="http://localhost:8042/">http://localhost:8042/</a> while Aardvark is running.

