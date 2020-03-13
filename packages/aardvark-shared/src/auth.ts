
// None of this is actual authenticating anything. Eventually this will be 
// replaced by some kind of public key crypto

export interface AuthedRequest
{
	nonce?: string;
	signature?: string;
};

export interface GadgetAuthedRequest extends AuthedRequest
{
	gadgetUuid: string;
	ownerUuid: string;
};

export function signRequest<T extends AuthedRequest>( request: T , privateKey: string ): T
{
	let nonce = Math.random().toString();

	let signed = {...request,
		nonce,
		signature: privateKey + nonce, // THIS IS NOT A REAL SIGNATURE. THIS IS A TODO.
	}
	return signed;
}

export function isSignatureValid( request: AuthedRequest, publicKey: string ): boolean
{
	return request[ "signature" ] == publicKey + request.nonce;
}

export function verifySignature( request: AuthedRequest, publicKey: string )
{
	if( !isSignatureValid( request, publicKey ) )
		throw new Error( "Invalid signature on request" );
}