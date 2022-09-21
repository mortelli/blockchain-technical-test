# Solidity Question: G

> _After analyzing the file “Signature.sol”, describe the use case of this contract, how to use it and all the technical steps (off-chain & on-chain) & key methods of the contract._

### Overview

This contract works as a sort of library, since all of its functions are declared as `pure`. This means that no state is read nor modified; rather, all functions work based purely on the received parameters and return their results using solely its inner logic.

As its name implies, the contract deals with signatures. Signatures are core concept in cryptography and are widely used in blockchain technology. They provide a way of assuring integrity and authenticity of messages or data.

### Key methods

The key method in the contract is `verify`. Its purpose is to make sure that signed data—which amounts to, ultimately, bytes—was indeed produced by the `_signer` address parameter provided in the call.

In other words: given an address, some data and a signature, this function will deterministically answer whether the signature was produced on said data by said address. If not, this could be due to 2 reasons: either the data (sometimes called "message") was tampered with—meaning the signer produced a valid signature on a message, but this message was modified along the way resulting in a different signature—or the signature corresponds to a different signer. There's ultimately no way to know the concrete reason for this failure due to the nature of hash functions, but the boolean result of this verification is still hugely useful.

In this case, the data is packed into a hash using the `getMessageHash` and `getEthSignedMessageHash` methods, which is standard procedure for various reasons, including ones related to data length and security. In this case, the message is made up of multiple fields:

- `_to`: an address that could be assumed ot be a destination of a message
- `_amount`: a quantity, possibly an amount of currency to be transferred
- `_message`: text included as part of the message
- `_nonce`: nonces are numbers used to prevent replay attacks. Without one, a sniffed legitimate message could be replayed, resulting in a possible attack depending on the business logic.

An additional piece of data is added to the message, which is the `"\x19Ethereum Signed Message:\n32"` string. Although debated, appending this text to the message being hashed prior to producing the signature is a widely adopted practice, although not officially required. It is, for example, the standard behavior of the Geth client.

The result of hashing all these fields is what is presumed to be signed afterwards: packing all this data results in the hash that is verified by this contract against the provided singature and signer parameters.

There's 2 additional functions present in the contract: `recoverSigner` and `splitSignature`. In terms of solidity code, these aren't new. The native `ecrecover` expects a signature de-composed into its `r`, `v` and `s` elements. `r` and `s` are documented parts of the widely-used ECDSA algorithm. `v` is a helper-sort of parameter which speeds up the process of figuring out which public key (and address, as a corolary) matches the signature.

`ecrecover` is the statement that will ultimately determine the final result of the verification call, as it extracts the address that procuded the signature based on the hash of the message, allowing the contract to verify whether this address matches the provided signer parameter or not.

## Usage

In terms of usage, this contract is a good candidate for a Solidity library, since it contains stateless, reusable code. The library could be embedded in a contract (using the `using x for y` notation) or deployed separately and then linked through its address.

Contracts that use this library (in one way or the other) can call it to verify signatures, but the signed messages will naturally need to have a matching structure as expected in the recovery function. This isn't necessarily a bad thing, since managing and providing the separate components of the message can result in more maintainable code (in comparison to receiving the entire hash as parameter).

Regarding off-chain usage: there are countless ways to sign messages, one of them being metamask. But it can be done programatically as well. There's also documented ways of hashing data in the same way as this contract does, but in other languages like javascript.

One could expect a dApp to receive signed messages, send these to a business logic contract, and have it verify that the signatures are valid, and act accordingly depending on the dApp logic.

It is worth noting that signature verification can be performed off-chain in multiple ways. This would be a cheaper alternative, but it is more centralized and needs trust to be placed on a system, unlike this contract (moreso if verified).
