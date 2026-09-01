# OP_RETURN, OP-20, OP Names and OP Inscriptions

Documentation for the Bitcoin `OP_RETURN` data carrier output and the three protocols
Bitcoin Universe indexes on it. The three share an output type and nothing else, so they
are documented separately here.

**Live site: <https://bitcoinuniverseio.github.io/op-return/>**

| | |
|---|---|
| Chain and network | bitcoin, mainnet |
| Document version | 1.0.0 |
| Lifecycle | experimental |
| Classification | protocol documentation |
| Portal | <https://docs.bitcoinuniverse.io> |

## The carrier

`OP_RETURN` is byte `0x6a` at the start of an output's `scriptPubKey`. Script evaluation
fails immediately, so the output is provably unspendable, and because it is provably
unspendable a node may drop it from the UTXO set entirely. The bytes stay in block history
forever; the lasting node cost is zero. The payload is the concatenation of every data
push after the opcode.

`OP_RETURN` bytes are non witness data, charged at four weight units per byte with no
discount. Keeping the whole `scriptPubKey` at 83 bytes or fewer, with one carrier output
per transaction, keeps a transaction relayable under both the long standing default data
carrier policy and current defaults. Relay policy is not consensus.

## The three protocols

| | OP-20 | OP Names | OP Inscriptions |
|---|---|---|---|
| Registry id | `op_return` | `op_names` | `op_inscriptions` |
| What it is | fungible tokens | singleton name ownership | content written into the carrier |
| Payload tag | `"p":"op-20"` | `"p":"opns"`, or bare `label.namespace` | `"p":"op-inscriptions"` |
| Operations | deploy, mint, transfer | reg, transfer | inscribe |
| Identity | NFC lowercase ticker | NFC lowercase `label.namespace` | `txid:vout` |
| Core availability | read-only | read-only | **enabled**, in-app execution |
| Tradeable in Core | no | no | **yes** |

That last row is the point of documenting the three together. Sharing a carrier buys them
nothing in common at the product layer. What decides tradeability is whether a settlement
authority exists that can prove a fill from chain data. OP Inscriptions has one. OP-20 and
OP Names do not, and their legacy marketplace mutations are retired and fail closed with
HTTP 410.

`op_names` is **not** the Ordinals based Sats Names System, which the organisation indexes
separately under the marketplace protocol id `names`.

## Pages

- [Home](https://bitcoinuniverseio.github.io/op-return/) what the carrier and the three protocols are, plus the verified capability matrix
- [Carrier](https://bitcoinuniverseio.github.io/op-return/carrier.html) unspendability, UTXO pruning, relay policy, fee cost, and a comparison with witness envelopes and unprunable output techniques
- [Specification](https://bitcoinuniverseio.github.io/op-return/spec.html) numbered rules: R-CAR, R-20, R-NAME, R-OPI, plus every rejection reason code
- [Guide](https://bitcoinuniverseio.github.io/op-return/guide.html) worked transaction examples and the full support matrix with recorded reasons
- [Reference](https://bitcoinuniverseio.github.io/op-return/reference.html) terminology, indexer semantics, security, limitations, implementation checklist
- [Test vectors](https://bitcoinuniverseio.github.io/op-return/vectors.html) 40 vectors of real script hex with the outcome each parser produced
- [Decoder](https://bitcoinuniverseio.github.io/op-return/decoder.html) client side tool that identifies and explains a payload
- [Changelog](https://bitcoinuniverseio.github.io/op-return/changelog.html) documentation version history

## How this is built

Hand authored static HTML, CSS and vanilla JavaScript. No build step, no framework, no
external fonts, no CDN, no trackers, no third party requests of any kind. Every ordinary
page works with JavaScript disabled; JavaScript adds only the theme toggle, search and the
decoder. Deployed by GitHub Pages from `main` at the repository root.

To work on it locally, open the files directly or serve the directory with any static
file server.

## Grounding

Facts on this site come from the organisation's own code:

- Capability rows and the recorded reason for every unsupported action come from the Core
  ecosystem capability snapshot, generated from the marketplace protocol registry in
  `bitcoinuniverseio/core`.
- OP-20 encoding, ticker normalisation and amount rules come from the OP-20 payload reader
  in the organisation's OP-20 indexer.
- OP Names identity, carrier and custody rules come from the OP Names authority parser and
  its authority document.
- OP Inscriptions classification, assembly and durability rules come from the OP
  Inscriptions record decoder and its indexer safety contract.
- Test vectors were produced by running those parsers over the exact script hex published.

Code presence is not released capability. Where support could not be verified in the
organisation's code, this documentation says so rather than claiming it.

## Contributing, support, security

- [CONTRIBUTING.md](CONTRIBUTING.md)
- [SUPPORT.md](SUPPORT.md)
- [SECURITY.md](SECURITY.md) for private vulnerability reporting

Licensed under [MIT](LICENSE).
