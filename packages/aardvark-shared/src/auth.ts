
// None of this is actual authenticating anything. Eventually this will be 
// replaced by some kind of public key crypto

export function generateRequestSignature( request: any, privateKey: string ): string
{
	return privateKey;
}

export function isSignatureValid( request: any, publicKey: string ): boolean
{
	return request[ "signature" ] == publicKey;
}

export function verifySignature( request: any, publicKey: string )
{
	if( !isSignatureValid( request, publicKey ) )
		throw new Error( "Invalid signature on request" );
}