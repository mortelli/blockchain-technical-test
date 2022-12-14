# General Questions: E

> _What are the centralization issues to be aware of when developing a smart contract ? Propose a technical solution for each of them._

In Ethereum, no-one can act on behalf of a smart contract. There is no private key to be stolen in oder to attack a system in a way in which an attacker can disguise themselves as a smart contract and abuse it.

As a consequence of this, centralization issues usually stem from access control, i.e. "who is allowed to do what". Many contracts implement ownership or role-based access control, meaning that there are addresses _other_ than the smart contract itself which have certain privileges or are allowed to execute certain admin or owner-only actions.

If there is no admin or owner of the contract, then this problem can be avoided. However, this tends not to be the case, as some access control is usually necessary in protocols or systems with non-trivial complexity.

If there is just _one_ address that controls everything in terms of protocol adjustments or admin-only actions, then security is entirely centralized. Having a more nuanced approach can help mitigate this problem. This means having role-based ownership instead of just 1 owner. This can be implemented in technical terms through OpenZeppelin's Access Control contracts. After roles are defined instead of just complete ownership for one address, more sensitive actions can be limited to more exclusive roles, meaning that the protocol can still be adjusted by some actors without them having complete power over it.

It's worth mentioning that other contracts can have roles granted to them. If the code for these contracts is verified, it can increase trust in the system and reduce the chance of abuse from privileged role-owners, since they can not operate _as freely_ as EOAs. However, if these contracts can be abused by EOAs through the issues previously stated, then it is not a definitive solution to this problem. This means that the kind of code housed in these contracts with granted roles matters.

When multiple accounts are owners or have roles granted to them, they can be abstracted away into a multi-signature scheme. This scheme uses a single address to act in representation of multiple parties, which will need to achieve a degree of agreement recorded in and controlled by a smart contract before the single multi-sig address can act as an owner or admin. This means that a threshold must be reached before a critical action (or one with abuse potential) can be taken, instead of having a single point of failure in the sense that just 1 actor with a privileged role could still cause issues.

Another problem in Ethereum is that external APIs cannot be called. So, for example, if an exchange rate between 2 coins needs to be used as part of a protocol, this has to be written to the blockchain in some way or another. Naturally, not just any actor should be able to do this, so the concept of "oracle" comes into play. Oracles are smart contracts which are explicitly trusted by other contracts to provide information external to the blockchain, such as API calls (but not limited to that).

The use of oracles is sometimes necessary, but it is still a type of centralization, since there is 1 entity which controls data which can be of critical importance in the business logic of a system. A way to mitigate this is to have a set of oracles instead of a single one. This can be more expensive, but it is safer, since multiple points of data could be extracted from the set of oracles, and a reasonable or valid answer for a required piece of information could still be computed even if one or more oracles are compromised, malicious, or incorrect.

Another way to mitigate this problem is to add expiration to external information. Smart contracts can be coded to use external data only if its age is below a certain parameter. The advantage to this is that when the protocol works, it can be assumed to use recent information, which in general has a better chance to be accurate, correct, or valid. However, if the information expires and no new data is supplied, it can cause a protocol to freeze entirely, so this also should be taken into consideration.

Although not a strictly technical solution, audit processes can be considerably benefitial in the development of any smart contract. An external point of view from parties well-versed in security issues and vulnerabilities (not just ones related to centralization) can prove to be of great value.
