**Aardvark in React**

The @aardvark/aardvark-react package includes many components that make building Aardvark gadgets straightforward.
These are the React components included in the core package:

* AvGrabbable
* AvSphereHandle

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

