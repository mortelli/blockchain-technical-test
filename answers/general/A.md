# General Questions: A

> _In Ethereum and blockchain ecosystem in general, what are the use-cases of hash functions?_

Due to the fact that hash functions are deterministic, collision resistant, one-way functions that produce entirely different outputs for any change in the input, they have been proven to be critically useful tools for the blockchain ecosystem—before Ethereum even existed—and this continues to be the case today.

The first example that comes to mind is block hashes. If an attacker were to modify a transaction in the past so that the receiver of it was their own address, this would result in a different root hash for the block that contains that transaction, since data in it was changed. Since each block contains the hash of the previous block, the hashes for each following block would also change. As a consequence of this, the attacker's submission of alternative chain (in which they are richer) would be rejected by non-malicious nodes since the resulting hashes from the point of the attack would differ. This is a direct consequence of how hashing functions work and their usefulness for detecting illegitimate or tampered-with data.

Hashing is also involved in the mining process. Because hash functions output fixed-length results, the mining process for a block is over once a miner finds number which, when used in conjunction with the mined block data, produces a hash with a certain number of leading zeroes (also known as difficulty). This means that hashing functions are a critical part of the Proof of Work consensus algorithm.

Hashing functions are also used as part of the process of signing messages. Digital signature algorithms such as ECDSA provide a way of assuring non-repudiation and data integrity, and are widely used in trustless environments. Calculating hashes is a neccesary step when deriving an address based on a public key, so hashes are used for both signing messages as well as verifying signatures.

Without hashes, it's not possible for a blockchain to protect its immutability, and currently it would also not be possible to prove a certain address signed a message. In its current state, breaking the hashing algorithm would mean breaking the security of any blockchain system that uses it.

Ethereum in particular uses the Keccak-256 hash function.
