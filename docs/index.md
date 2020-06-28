# Aardvark in React

The @aardvarkxr/aardvark-react package includes many components that make building Aardvark gadgets straightforward.
You can find documentation for those components [here](aardvark-react/).
More details on initializing and building your first gadget below.

## Making your first gadget

[Look here](getting_started) for instructions on building your first gadget.

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

