# Aardvark in React

The @aardvarkxr/aardvark-react package includes many components that make building Aardvark gadgets straightforward.
You can find documentation for those components [here](aardvark-react/).
More details on initializing and building your first gadget below.

# Installing useful tools

`avcmd` is a command line tool that provides a bunch of useful Aardvark-related functionality. 
To install it, run:

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


The render function in your own root React component might look something like this:

```
					<AvGrabbable updateHighlight={ this.onGrabbableHighlight } 
						dropOnHooks={ true }>
						<AvSphereHandle radius={0.1} />
						{ charms }
						{ grabbedMode && <AvModel uri="http://aardvark.install/models/bracelet.glb" /> }
						{ this.renderControls() }
					</AvGrabbable>
```

