# General Questions: C

> _What are the different types of bridges and how do they work ? Explain in detail step by step how bridging an ERC721 would work._

As the blockchain ecosystem moves forwards with a greater and greater amount of networks, the interest of transferring assets between them has grown as well. This is the basic definition of a blockchain bridge: a system that allows crypto assets to be moved between networks.

The two main categories of bridges are _trusted_ and _trustless_.

Trusted bridges will require end-users to hand over control of their assets to the party that manages or operate the bridge. This isn't necessarily a bad thing, it just means that the user will have to explicitly trust the entity in control of the bridge for it to be used. As with most trust-based entities, these bridges depend largely on reputation for their adoption and success. These are sometimes called _custodial_ or _centralized_ bridges.

Trustless bridges, on the other hand, operate openly based on a set of smart contracts (a protocol) and specific algorithms. This means that any end-user can make their own judgement on how safe it is to use a particular bridge; no trust needs to be placed on the system. They are as safe as the smart contracts that they use, which in turn are as safe as the blockchain on which they are deployed. These are sometimes called _non-custodial_ or _descentralized_ bridges.

Bridges can also be classified as one-way or two-way, depending on whether or not users are allowed to bridge assets in one direction plus its reverse.

Typically, a bridge will operate by accepting an asset on one network and locking it inside a smart contract, in turn releasing, issuing or minting a counterpart asset on the other network. This can be, for example, 2 different tokens, native or not. Additionally, fees can be charged each time these conversions occur.

For ERC721 tokens, a set of smart contracts (at least one on each network) plus an off-chain component would be needed for the whole process to work.

For this example, let's assume both networks share the same address space, meaning that the same private key can be used to derive the same address on both networks in an equivalent manner. NFT owners (EOAs or smart contracts) need to first clearly identify which asset they want to move from its original network. This means the collection address as well as the specific token ID. Then, the contract (called "bridge contract") which locks assets on this original network should be identified, and then the asset ID should be approved for that contract address. This will allow the smart contract to take ownership and lock the asset in order for its bridged counterpart to be issued. As an alternative, the user could transfer the asset themselves. In that case, it's a sensible idea to check whether the contract can receive ERC721 tokens, so this should be executed using `safeTransferFrom`.

The bridge smart contract on the source network would store all the relevant information of the ERC721 in order to issue the bridged asset using the same metadata on the target network, through the bridge contract that deployed in it.

However, even after locking the asset, the source and target network remain not natively connected. This is why an external component that can listen to contract events (such as taking hold of an asset and locking it for it to be bridged) is needed for the process to be completed. This component would be aware of an asset being transferred to the contract from a specific user, and call a method of the bridge contract on the target network which would either mint or issue the equivalent bridged asset directly to the same address, or logically unlock it for (only) the user to later call the contract and claim it on the destination network.

After issuing the equivalent NFT on the target network, an analogous inverse process could be executed for transferring the asset back the other way. In this case, the off-chain component would listen to events from the other network's bridge contract, and call its counterpart instead.

Naturally, the collection must exist on both the source and target network and be supported by the bridge protocol. These 2 contracts will have different addresses, but be able to mint equivalent assets.

In principle, it could be left to the user to execute as many calls as possible on both networks, but the confirmation that the asset was frozen or locked in its original network still needs to be written to the target blockchain in one way or another. If not a direct call, an update to an oracle could be submitted, and then let the bridge contract on the target network consult it. Under this architecture, the aformentioned off-chain watcher component is necessary to communicate the bridge contracts on either side, but it is not a trustless component as they are. This implies that there is at least some centralization to this solution.

It should be kept in mind no fees are being considered in this process, which might be required from a user, in native or non-native tokens.
