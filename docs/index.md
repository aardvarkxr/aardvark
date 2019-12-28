**Aardvark in React**

The @aardvarkxr/aardvark-react package includes many components that make building Aardvark gadgets straightforward.
You can find documentation for those components (here)[aardvark-react/].

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

