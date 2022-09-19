# Solidity Question: I

> _How would you build a proxy contract where the implementation lives in another contract in solidity (do not worry about syntax error or mispel)_

In addition to the contract that houses "the implementation" (called _logic contract_) an additional contract which stores its address is needed. This additional contract is called _proxy contract_ and it's the entry point for the oustide world (such as dApps) in terms of interacting with the business logic that resides in the logic contract. This, of course, does not prevent the outside world from contacting the logic contract directly, so this also needs to be dealt with.

Calls from the proxy contract need to be redirected to the logic contract, but maintaining context. This means that values such as `msg.sender` need to be the same when the call is made to the proxy contract as well as when the call is redirected to the logic contract—and not take the value of the proxy contract, for example.

If done correctly, this results in a wrapper contract which never changes address, but can redirect to different implementations (upgrades) in a manner which does not affect the communication between the proxy and the outside world.

The immediate problem to be solved is finding a way to forward calls correctly in a maintainable manner. Unfortunately, this currently cannot be done without the use of low-level `assembly` statements, which need to copy incoming call data, delegate the call to the logic contract, retrieve the result, and forward this result back to the original caller. This low-level code needs to be part of the fallback function of the proxy contract, since outside calls will invoke methods not implemented by the proxy, and so the fallback function will be the point in which code can be executed for these incoming, unmatched calls.

In this way, the proxy contract is the middleman between the caller and the logic contract. And because of how the delegation of calls is made, state is kept in the proxy contract, and not in the logic contract. This solves the problem of interacting directly with the logic contract (since it will have no state modifications by itself, but only through the use of the proxy) while maintaining its state for new implementations that upgrade the logic.

However, because calls are delegated, references to where variables are stored in the logic contract could collide with the storage kept by the proxy contract, which stores its own data but must also keep track of the state of the logic contract that it points to. The _Unstructured Storage_ pattern can be used to solve this problem. The basic idea behind this pattern is choosing a different slots for storing data from what would usually be chosen, and used by any standard contract such as the logic contract. This prevents variables being overwritten by the logic contract once a call is delegated.

This pattern, however, does not solve the problem of storage collisions occuring between different implementations of the logic contract. As a limitation, storage needs to be _extended_ in new implementations, rather than replaced, modified or overwritten.

Writing proxies from scratch is a technically demanding task that demands a very in-depth understanding of the EVM and how smart contracts work. Consequentially, in terms of implementing real-world proxy contracts, it's a sensible idea to use already-proven solutions instead of re-inventing the wheel.

OpenZeppelin provides [upgrade plugins](https://docs.openzeppelin.com/upgrades-plugins/1.x/) for both Truffle as well as Hardhat, which make the process of setting up a proxy contract for any given logic contract a much more simplified endeavor. This tool can help initialize a logic contract behind a proxy, as well as detect collisions between an implementation and its upgrade, among other things.
