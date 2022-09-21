# Blockchain Technical Test

This repo contains answers for a Blockchain Technical Test challenge, as well as the code for the practical excercise (question `J`).

Answers for each individual question can be found in the [answers](./answers/) directory.

## Practical excercise documentation

Solidity code for the solution can be found in the [contracts](./contracts/) directory.

Typescript test code for the solution can be found in the [test](./tests/) directory.

### Usage

Standard [Hardhat commands](https://hardhat.org/hardhat-runner/docs/getting-started#running-tasks) are available.

For the full list of commands please check the [package.json](./package.json) file.

#### Installation

```shell
npm i
```

#### Tests

```shell
npm run test
```

#### Test coverage

```shell
npm run coverage
```

### Development notes

Here's a list of additional restrictions imposed as well as liberties taken for developing the `CampaignSale` contract:

1. the maximum length for a campaign is exposed as a public constant so users can query it in case a campaign launch reverts with a `campaign length exceeds maximum` error
2. a campaign cannot be launched with a goal of `0` tokens
3. a specific `campaign does not exist` error was added to the _cancel_, _contribute to_, _withdraw from_, _claim_, _refund_ and _get campaign_ functionalities
4. campaigns are deleted in order to follow the instructions; it would have been preferrable to disable them instead (see [here](https://github.com/crytic/slither/wiki/Detector-Documentation#deletion-on-mapping-containing-a-structure) for reasons why)
5. a campaign cannot be contributed to or withdrawn from using an amount of `0` tokens
6. even after a campaign is refunded, the `pledged` field will still record the amount deposited for historical purposes
