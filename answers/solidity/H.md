# Solidity Question: H

> _Perform an audit of the contract “Staking.sol”, find at least 3 technical technical, logic issues or hacks, explain why it is an issue and provide a way to fix those._

## `addReward`

The return value for the `transferFrom` call is unchecked. If the ERC20 token implementation used does not revert in case of transfer failure, the function could be called indefinitely and independently of the token balance held by the user.

This is clearly unintended behavior and an attack vector.

The fix for this is to use `safeTransferFrom`/`SafeERC20`, or to inspect the value of the transfer result and reverting the function call if it equals `false`.

Additionally, events should be emitted before transfers are executed. If the transfer call causes a re-entrancy, the last events will be emitted first due to the call stack. This might not have serious effects, but it can cause events to be read out of order outside of the blockchain (e.g. by dApps).

## `approveReward`

This function emits an event with `_msgSender()` as the `account` address field of the `ApproveReward` event. Since only the owner can call this function, this field will always be set to the owner of the contract.

This was probably intended to be the `_spender` parameter instead.

## `deposit`

The same unchecked transfer error and out-of-order events as in `addReward` occur here.

Additionally, `tx.origin` is used as if it were the same as `_msgSender()`. These 2 can differ, depending on whether the current call is part of a call chain.

This can have unexpected consequences, such as balance being transferred out of a different entity than the one making the deposit. `tx.origin` should be replaced with `_msgSender()` to fix this.

## `withdraw`

The same unchecked transfer error and out-of-order events as in `addReward` occur here.

In this function, `_lastDepositTime` is updated to "now" right before computing a reward for the user. This is conceptually incorrect, since deposit time is not the same as withdraw time.

In fact, it will cause the user's reward to have a value of `0`, since:

```solidity
block.timestamp - _lastDepositTime[account] == 0
```

and

```solidity
0 < _duration
```

causing `durationDelta` to equal `0`, and therefore the reward to have a value of `0` as well.

This line should be removed, and let the last depost time be updated on the next deposit.

Moreover, this function's 2 `require` statements can never fail. Because `totalStaked` and `rewardTotal` are defined as `uint`, they can never take a negative value. If `amount` or `reward` were to take greater values than them, the substraction would underflow, causing a revert of the `withdraw` call before the `require` statements are reached.

This function should also require user balance to be greater than `0` and revert otherwise, in order to save gas and prevent meaningless transfers of 0 tokens.

## `computeReward`

Becuase `_duration` can be set at any point in time by the owner, rewards can have their values unfairly and unexpectedly changed for users if the owner changes this parameter.

If a user makes a deposit when the duration is 4 weeks, but right before 4 weeks have passed the owner extends the duration to 5 weeks, then the terms of the agreement have changed without the user's consent.

The user will expect a 2% reward after 4 weeks have passed, but they will get less than that because of the new duration delta, now smaller than the set duration.

A way to fix this would be to have a duration recorded per user at the moment that they make a deposit (taking the value set in the contract at that point), and using it instead of the global duration that can change at any point in time.

Besides this, usage of `block.timestamp` is generally discouraged since it is a value that can be slightly manipulated by miners. However, since it is not used for randomness here, its potential as an attack vector is of low severity.

It could, at worse, cause a _slightly_ bigger reward if manipulated to be greater than its actual value, only for the case of a withdrawal made in less than 1 week since the last deposit was made.

In the long run, however, it can not be modified too much, since both the blockchain protocol as well as other miners will reject too big a difference.
