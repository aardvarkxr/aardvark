import * as IPFS from 'ipfs';

let ipfsNode: any = null;

async function init()
{
	ipfsNode = await IPFS.create();
	const version = await ipfsNode.version()

	console.log('IPFS Version:', version.version );
}

async function cleanup()
{
	await ipfsNode?.stop();
	ipfsNode = null;
}

function instance(): any
{
	return ipfsNode;
}

export const ipfsUtils = 
{
	init,
	cleanup,
	instance,
};
