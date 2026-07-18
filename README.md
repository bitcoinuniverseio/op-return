# OP_RETURN / OP-20 documentation

Bitcoin Universe documentation for OP_RETURN / OP-20 on Bitcoin.

## What this covers

OP_RETURN is a Bitcoin script pattern for carrying provably unspendable data. OP-20 is a separate experiment that places token messages in that carrier and interprets balances through its own indexer rules.

## State model

The Bitcoin network accepts an OP_RETURN output as data. It does not create an OP-20 balance by itself. The protocol reader interprets the JSON, transaction order, address fields, and UTXO movements.

## Documentation site

- Overview: [index.html](index.html)
- Field reference: [reference.html](reference.html)
- Build and verification playbook: [guide.html](guide.html)

## Core rules

- OP_RETURN is a carrier, not a fungible token standard.
- OP-20 uses p set to op-20 and deploy, mint, or transfer operations.
- The first deployment of a ticker wins under case-insensitive comparison.
- OP-20 documents one OP_RETURN output per transaction.
- A deployment and mint include add, the recipient address field.
- Precision may be up to 18 decimals under published OP-20 rules.

## Source material

- [OP-20 experiment documentation](https://op20labs.gitbook.io/op-20-experiment)
- [Bitcoin developer guide, OP_RETURN](https://developer.bitcoin.org/devguide/transactions.html)

## Scope

OP-20 describes itself as an experiment. Build clear user warnings into any product flow and never present token validity as Bitcoin consensus.
