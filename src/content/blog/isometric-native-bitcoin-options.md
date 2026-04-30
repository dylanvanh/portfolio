---
title: "Isometric: Bitcoin Options Without leaving the Bitcoin ecosystem"
description: "Covered calls on BTC, collateralised in BTC, settled on ICP."
pubDate: 2026-04-30
tags: ["bitcoin", "icp", "options", "isometric"]
image: "/blog/isometric-native-bitcoin-options.png"
---

![Bitcoin options built on ICP: Isometric and Internet Computer branding](/blog/isometric-native-bitcoin-options.png)

Covered calls on BTC, collateralised in BTC, settled on ICP.

[Isometric](https://isometric.fi) ([@isometricfi](https://x.com/isometricfi)), created by [me](https://x.com/obonobza) and [@npm_luko](https://x.com/npm_luko), is launching in public beta soon. Writers earn premium by locking BTC against an offer. Buyers pay that premium for upside exposure until expiry.

Isometric runs on the [Internet Computer](https://internetcomputer.org) and makes use of ckBTC for all transactions inside the platform.

Users deposit BTC using the ckBTC minter to a unique Bitcoin address assigned to every new user. The platform uses BTC/USD rates and settles expired options on a schedule, without an exchange account or bridge custodian controlling user balances.

## The Problem

Lots of people want to trade BTC options, but almost nobody trades them on Bitcoin. Today you have to sign up for a centralised exchange, hand over your BTC, pass KYC, and trust the exchange to stay solvent. If they freeze withdrawals, your BTC is stuck.

Isometric removes that friction from the user flow. A Bitcoin native options platform should let users deposit BTC, trade with BTC denominated balances, and withdraw BTC when they are done. It should settle expired options itself instead of asking either side to come back and click a button.

That gave Isometric three constraints:

- **Native BTC in and out:** users deposit BTC and withdraw BTC through ckBTC.
- **Fully collateralised options:** writers commit the BTC denominated collateral needed to cover the trade.
- **Automatic settlement:** the protocol checks expiry and pays the result without user action.

## Why the Internet Computer

Most smart contract or decentralised platforms cannot use Bitcoin directly. They rely on wrapped BTC issued by a company, a multisig, or a bridge committee.

ckBTC works differently. You send BTC to a real Bitcoin address that the ckBTC minter controls through ICP's threshold signing. No company or custodian holds the private key. ICP subnet nodes hold shares of the key via threshold ECDSA, reach consensus on valid transactions, and jointly produce Bitcoin signatures when a withdrawal requires one.

![Internet Computer protocol branding](/blog/isometric-icp-branding.png)

Isometric leans on three parts of ICP:

- **ckBTC.** Isometric uses the ckBTC minter for BTC deposits and withdrawals. Inside ICP, ckBTC moves without Bitcoin mempool delays, so premiums, collateral, and payouts can move inside the platform without raw UTXO handling.
- **Price oracle.** ICP's exchange rate canister provides BTC/USD rates from multiple data sources, so the protocol does not rely on a single exchange price.
- **Automatic schedule.** ICP canisters can run scheduled work, paid for by the platform. Isometric uses that path to settle expired options.

Users think in BTC. Isometric presents BTC denominated balances while ckBTC handles the accounting underneath.

## Architecture Overview

Isometric has a few roles:

- **Writer:** deposits BTC and creates a covered call offer.
- **Buyer:** accepts the offer and pays a premium.
- **Platform:** tracks balances, handles collateral, activates options, and settles them.
- **ckBTC:** how deposited BTC is represented on ICP. Users still deposit and withdraw BTC at the edges.
- **Price oracle:** the BTC/USD rate used for strike and settlement.

![Isometric option lifecycle: writer, buyer, platform, oracle, and settlement](/blog/isometric-native-bitcoin-options-mermaid.png)

## The Flow

### 1. Deposit BTC

A user deposits BTC using the ckBTC minter unique deposit address. After the Bitcoin confirmations clear and ckBTC mints, the platform shows a BTC denominated balance backed one for one by ckBTC.

Moving BTC in or out still depends on Bitcoin confirmation time. Once funds sit inside the platform, offers, premium payments, collateral, and settlement move on ICP.

### 2. Create a Covered Call

A writer lists an offer with the amount of BTC they want to cover, the premium, and the strike. The strike is not a fixed USD price. It is a percentage above spot, like "10% above market".

That keeps offers usable as BTC moves. If writers had to enter a dollar strike every time BTC moved, their offers would go stale within minutes. A percentage strike tracks the market. An offer posted at "10% above spot" still means the same thing an hour later, even if BTC has moved.

The exact USD strike locks when a buyer accepts.

### 3. Accept the Option

When a buyer accepts, the platform performs the following steps:

- Reads the current BTC/USD price from the oracle.
- Converts the writer's percentage strike into a locked USD strike at that price.
- Commits the writer's BTC collateral.
- Credits the premium to the writer.
- Turns the offer into an active option.

From that moment, both sides have a clear reference price for the rest of the option's life.

### 4. Wait for Expiry

Until expiry, the buyer holds the option. If BTC settles above the strike, they collect the difference in BTC. If it settles at or below, the writer keeps their full collateral and the option ends worthless.

Both sides know their worst case up front. The writer can only lose the BTC they committed, nothing more. The buyer can only lose the premium, nothing more. No margin calls, no liquidations.

### 5. Settle Automatically

At expiry, Isometric picks up expired options, reads the BTC/USD price from the oracle, and pays the correct side.

There are two outcomes:

- **In the money (BTC above strike).** The buyer gets the profit in BTC after fees. The writer gets whatever collateral is left.
- **Out of the money (BTC at or below strike).** The writer gets their full collateral back. The buyer's option ends worthless.

Either way, the payout lands in a BTC balance the user can withdraw.

## Try it

- **Trade:** [isometric.fi](https://isometric.fi)
- **Docs:** [docs.isometric.fi](https://docs.isometric.fi)

## Dig deeper on ICP

- [ckBTC](https://docs.internetcomputer.org/reference/protocol-canisters/#ckbtc-minter): how the ckBTC minter and ledger work under the hood.
- [Bitcoin integration](https://docs.internetcomputer.org/guides/chain-fusion/bitcoin/): the native Bitcoin API ICP exposes to canisters.
- [Threshold signatures](https://docs.internetcomputer.org/concepts/chain-key-cryptography/): how ICP signs Bitcoin transactions across subnet nodes.

Source: [announcement on X](https://x.com/obonobza/status/2049922582179139989).
