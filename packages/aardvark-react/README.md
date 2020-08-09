This package is a collection of React components that allow easy construction of gadgets that produce Aardvark scene graphs.

To get started, cd to an empty directory and type: 

	npm init @aardvarkxr

This will install the @aardvarkxr/create script and then run it. Answer the prompts to set up your gadget.

Then run:

	npm install
	npm run build

After that you probably want to start up a dev server to host your gadget during development. `http-dev-server` works for that.

	npm install -g http-dev-server
	http-dev-server --cors <path to gadget>

Then open your gadget in a local browser to get an "add to favorites" button that will let you see it in Aardvark's gadget menu. 
Once you have the gadget in your favorites you can just rebuild and reload it without needing to tell Aardvark anything new about the gadget. 
It just stores a link to the gadget, not any of the built "binaries".

You can open your gadget directory in Visual Studio Code to aid in react/aardvark development.
