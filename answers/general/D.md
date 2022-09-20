# General Questions: D

> _Describe the EIP-2771 standard with your own words and describe some use cases using this EIP._

EIP-2771 is a scoped proposal on how to accept or reject incoming meta-transactions in a contract (called "recipient") and sent by another trusted contract (called "forwarder") which originates these requests.

Meta-transactions are transactions which contain (other) embedded transactions in them. They are a sort of "wrapped" transaction or request. It might sound far-fetched, but the concept makes a lot of sense and proves its usefulness when it is considered that the embedded transaction retains its integrity as a request from a third party, _but at the same time_ cannot/will not be paid for with ETH (or any other native token of choice).

This EIP (or meta-transactions, in general) do not propose a change to the EVM in terms of whether gas is paid for or not, or even how it is paid for. As far as the blockchain is concerned, everything remains the same: all transactions use gas and this gas must be paid for, all transactions have a _sender_, and so on. 

So it is up to the contracts to go further than this point, i.e. reading the data contained in a transaction, interpreting the embedded sender (which is not the transaction sender) and executing their implicit request.

Although it is out of scope for this EIP, the assumed scenario is that there is a gasless actor (also called "transaction signer") that emits a request, which is created off-chain and signed, just as a transaction would be. Then, a system or entity can receive and hand the request over to the forwarder contract. The forwarder contract would be in charge of verifying that the request is legitimate. This problem (verification of a signature) has been solved in smart contracts before and its solution widely documented, so it is not a part of this proposal.

What is proposed here is that the recipient contract expect the transaction signer address to be appended to the call data (originated from the forwarder) as its last 20 bytes. These are interpreted as "the original sender" and assumed to be legitimate, based on the additional assumption that the forwarder has verified the correctness and legitimacy of the request generated by the transaction signer off-chain. The business-logic sender can be interpreted to match the transaction sender if the message data is shorter than 20 bytes or if the forwarder is not considered trusted by the recipient.

Naturally, the recipient must trust the forwarder to have verified and correctly set the original sender in the call data. It is up to the recipient contract to determine which forwarders to trust and which not to trust. The EIP suggests an immutable forwarder, but a more nuanced approached could be taken. However, misplacing trust on a malicious forwarder would compromise the security of the system in its entirety, since meta-transactions could be spoofed in terms of origin.

In summary, for a recipient to support meta transactions, it needs to use a different value for the message sender depending on the caller: if it is trusted and the call data is longer than 20 bytes, then use those last 20 bytes as a "logic" sender and execute whatever smart contract logic the recipient contains. If not, use the standard sender and proceed normally.

Although no EVM changes are proposed, it is clear that supporting meta-transactions requires—minimally—for the recipient contract to be aware of them, for it to expect an original sender address encoded in a particular way, and for it to explicitly trust the forwarder that sends the meta-transactions.

This EIP does not address the fact that there needs to be a way to fund the forwarder, since it is the entity that pays for the wrapping transaction. This can also be considered out of scope for this EIP. 

Since meta-transactions are ETH-less or gasless transactions, the most obvious use case for this is lowering the entrance barrier for new users of a system. Because transactions must be paid for with native tokens (which for users ultimately means fiat money), this can result in resistance of adoption of any system which uses transactions, i.e. dApps. 

One could choose to fund specific types of transactions for free for new users, assuming the gas costs in exchange for system adoption. Or, alternatively, one could accept tokens as a form of payment. Meaning: the user does not pay for gas, but as a result of executing the meta-transaction, tokens are transferred from the transaction signer to some other account of the system, resulting in an exchange of transaction execution (or gas) for non-native tokens. The approval of the tokens must be authorized and be part of the meta-transaction logic and be ultimately executed at the recipient level, as an atomic operation included in the execution of the embedded transaction itself.

If non-native tokens can be used to paid for gas, this could also result in an increase of value for that particular coin. An ERC20 token or governance token could have its value increased if it is accepted (even in controlled or limited contexts) as payment for gas.

This can also appear to increase privacy. Everything on the blockchain should be assumed public since it is the nature of such ledgers, and transactions could eventually be reverse-engineered to be plainly read. However, the executor of meta-transactions is always the same entity (or set of entities), so this can make the process of reverse-engineering this data slightly harder (but never impossible).

Additionally, it is a way of centralizing gas costs. In terms of accounting, it is much easier to keep track of gas spent by a single entity rather than by all users of a platform, but this is more of an administrative use case or advantage.

Regardless of how they are paid for by the transaction signer, meta-transactions allow end-user to submit requests to a system in a completely off-chain manner, which might prove useful or attractive to some kinds of systems.