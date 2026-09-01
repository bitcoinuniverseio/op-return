# Support

## What this repository is

Documentation for the Bitcoin `OP_RETURN` data carrier and the three protocols Bitcoin
Universe indexes on it. It is not a product, a wallet, an indexer or an API. Nothing here
holds funds or executes transactions.

Live site: <https://bitcoinuniverseio.github.io/op-return/>

## Answering your own question first

| Question | Where to look |
|---|---|
| What does this script hex mean? | [Decoder](https://bitcoinuniverseio.github.io/op-return/decoder.html) |
| Why was my payload rejected? | [Invalid conditions](https://bitcoinuniverseio.github.io/op-return/spec.html#invalid) and the [test vectors](https://bitcoinuniverseio.github.io/op-return/vectors.html) |
| Can I sell my OP-20 token in Core? | No. See the [support matrix](https://bitcoinuniverseio.github.io/op-return/guide.html#matrix) |
| Can I sell an OP inscription in Core? | Yes, list, unlist, buy, settle and reconcile all run in app |
| Why does my balance look wrong? | [Indexer semantics](https://bitcoinuniverseio.github.io/op-return/reference.html#semantics) and [limitations](https://bitcoinuniverseio.github.io/op-return/reference.html#limits) |
| My wallet spent my asset as change | [Funding safety](https://bitcoinuniverseio.github.io/op-return/reference.html#screening) |
| Is OP Names the same as SNS? | No. They are different protocols on different carriers |

## Getting help

- **A documentation error, a missing rule, or a broken link:** open an issue at
  <https://github.com/bitcoinuniverseio/op-return/issues>. Include the page and, where it
  applies, the exact script hex.
- **A security problem:** do not open an issue. Follow [SECURITY.md](SECURITY.md).
- **A problem with a Bitcoin Universe product rather than with this documentation:** this
  repository cannot help. Use the support path for that product.

## What this repository cannot do

- Recover funds. An `OP_RETURN` output is provably unspendable, and value sent to one is
  destroyed with no recovery path.
- Reverse a transaction, refund a fee, or undo a rejected payload.
- Register, transfer, list or sell anything.
- Tell you the current state of a name, a balance or a listing. This site documents rules,
  not live state.
