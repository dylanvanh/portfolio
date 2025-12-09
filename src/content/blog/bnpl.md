---
title: "BNPL on Bitcoin: How Liquidium.wtf Lets You Buy Ordinals Now and Pay Later"
description: "A technical deep-dive into how I built Buy Now Pay Later for Ordinals at Liquidium.wtf, using atomic Bitcoin transactions and ICP canisters."
pubDate: 2024-12-08
tags: ["bitcoin", "ordinals", "icp", "liquidium"]
image: "/blog/bnpl-satflow-screenshot.png"
---

I recently built the BNPL (Buy Now Pay Later) system for Ordinals at [Liquidium.wtf](https://liquidium.wtf). It's now live with an integration on the [Satflow](https://satflow.com) marketplace. This post covers how it works from an implementation perspective.

![BNPL purchase flow on Satflow](/blog/bnpl-satflow-screenshot.png)

## The Problem

When someone wants to buy an Ordinal but doesn't have the full BTC amount, they need a way to secure the asset now while paying later. This opens up speculative trading opportunities: buyers can acquire assets with minimal upfront capital, then decide whether to repay based on price movement. If the floor drops below their loan, they can walk away. If it rises, they repay and pocket the profit.

We needed a solution with specific constraints:

- **No Custody:** The asset shouldn't be held by a trusted third party.
- **Immediate Settlement:** The seller must get paid immediately.
- **Atomic Swap:** The loan and purchase must happen in a single atomic action.

## Architecture Overview

The system involves four main components:

- **Marketplace** (e.g. Satflow) handles user interaction, creates and stages the first transaction
- **Liquidium.wtf Platform** handles validation and coordinates with the canisters
- **Instant Loans Canister** (ICP) validates loan terms and signs as lender
- **BNPL Canister** (ICP) stores the hidden transaction and handles atomic broadcast

The key insight is that we use two linked Bitcoin transactions that get broadcast together as a package. Transaction 1 **(TX1)** moves the Ordinal to an intermediate output. Transaction 2 **(TX2)** spends that output into escrow while paying the seller. Neither transaction is valid without the other.

![BNPL sequence diagram](/blog/bnpl-on-bitcoin-liquidium-ordinals-mermaid.png)

## The Flow

### 1. Marketplace Stages TX1

The marketplace creates and signs TX1, then calls `store_collateral_tx` directly on the BNPL canister. Their ICP principal is whitelisted, so only the marketplace can call this method:

```rust
#[update]
pub async fn store_collateral_tx(signed_tx_hex: String) -> Result<String, BnplError> {
    is_admin().await?;
    add_collateral_tx_to_storage(signed_tx_hex)
}
```

The canister:
- Validates the transaction structure (single input/output, version 3, non-zero value)
- Stores it along with the origin UTXO information
- Does NOT broadcast TX1 yet.

### 2. Buyer Prepares and Signs

The buyer selects an Ordinal on the marketplace and chooses BNPL. The platform validates their funds, dummy UTXOs, and creates the TX2 PSBT. The buyer signs their inputs.

### 3. Instant Loans Canister Processes

When the buyer submits, the request goes to the Instant Loans canister which:

- Validates the loan terms (LTV, floor price)
- Verifies the collateral transaction exists
- Signs TX2 as the lender
- Triggers the atomic broadcast

### 4. Atomic Broadcast

The BNPL canister handles the final step:

- Receives the broadcast request
- Fetches the stored TX1
- Validates that TX2 actually spends from TX1
- Submits both as a package using the `submitpackage` RPC

This ensures both transactions enter the mempool together. Either both confirm or neither does.

## Transaction Structure

### TX1 (Collateral Preparation)

Created by the marketplace and stored in the BNPL canister before broadcast. It has exactly one input (the Ordinal's current location) and one output (Marketplace multisig escrow).

```
Inputs:                     Outputs:
┌──────────────────┐        ┌──────────────────┐
│ Origin UTXO      │───────►│ Collateral       │
│ (inscription)    │        │ Output           │
└──────────────────┘        └──────────────────┘
```

The canister tracks the origin UTXO so we know exactly where the Ordinal came from.

You can see an example TX1 on-chain here: [d23308e...1ff3e68](https://ordiscan.com/tx/d23308e88b40f4166d880f5eb8b308cf239cff6cfcf38129ac538c3cb1ff3e68)

### TX2 (Loan Transaction)

Created by the platform, this transaction spends TX1's output and distributes funds to all parties:

```
Inputs:                         Outputs:
┌──────────────────┐            ┌────────────────────────┐
│ Dummy 1          │            │ Dummy Consolidation    │
├──────────────────┤            ├────────────────────────┤
│ Dummy 2          │            │ Escrow (ordinal here)  │
├──────────────────┤            ├────────────────────────┤
│ Collateral       │◄─ TX1:0    │ Seller Payment         │
├──────────────────┤            ├────────────────────────┤
│ Lender UTXOs     │            │ Marketplace Fee        │
├──────────────────┤            ├────────────────────────┤
│ Buyer UTXOs      │            │ Initiation Fee         │
└──────────────────┘            ├────────────────────────┤
                                │ Lender Change (opt)    │
                                ├────────────────────────┤
                                │ Buyer Change (opt)     │
                                └────────────────────────┘
```

Because Ordinals are tracked by their specific satoshi offset, position in the transaction inputs matters. We inject "Dummy UTXOs" as padding inputs to shift the Ordinal's index, ensuring the inscription lands exactly in the Escrow output and not in a change address or fee.

Both transactions use Bitcoin version 3 (TRUC/BIP-431), which enables package relay. This standard is supported by Bitcoin Core 28.0+ and major mining pools have adopted these mempool policies, making atomic package broadcasts reliable in practice.

You can see an example TX2 on-chain here: [6defa0e...e1733e](https://ordiscan.com/tx/6defa0e3e45b092bed93eeaaef842ef645a6bd1d3f46db3387c997c097e1733e)

## PSBT Signing and Signature Types

TX2 requires signatures from four parties. The key to making this work is using specific [signature hash types](https://developer.bitcoin.org/devguide/transactions.html#signature-hash-types) to let parties sign different parts of the transaction independently:

- **Seller (TX1 & TX2 input):** Signs with `SIGHASH_SINGLE | ANYONECANPAY`. This commits *only* to their input and their payment output. They can sign early without knowing the buyer or loan details.
- **Buyer:** Signs their payment inputs with `SIGHASH_ALL`.
- **Liquidium (Lender):** Signs lender inputs with `SIGHASH_ALL` after validating loan terms.
- **Marketplace:** Signs the 2/2 multisig spend last to finalize the transaction.

The signing flow:

1. Seller signs TX1 and TX2 (listing input only) with `SIGHASH_SINGLE | ANYONECANPAY`
2. Buyer initiates purchase on marketplace
3. Full TX2 PSBT is constructed
4. Buyer signs with `SIGHASH_ALL`
5. Marketplace signs the 2/2 inscription spend (completing the multisig)
6. Liquidium signs lender inputs with `SIGHASH_ALL` via API call after validating PSBT
7. TX2 is finalized and package broadcast with TX1

## Security Considerations

- **TX1 stays hidden until broadcast:** The BNPL canister acts as a secure enclave holding the signed TX1 off-chain. Even Liquidium cannot view the fully signed transaction stored in the canister. The ICP runtime ensures data privacy until the canister explicitly reveals it during broadcast. This prevents front-running where someone sees TX1 in the mempool and acts before the loan finalizes.
- **Origin UTXO tracking:** The BNPL canister tracks exactly where the Ordinal came from, allowing validation that the correct inscription is being used.
- **TRUC constraints:** Version 3 transactions enable package relay, preventing replacement and pinning attacks. The 1-parent-1-child topology restriction also limits the attack surface for transaction pinning.
- **Inter-canister authorization:** Only whitelisted canisters and admin icp principals can interact with the BNPL canister.
- **Atomic dependency:** TX2 explicitly spends TX1's output. If TX1 isn't present, TX2 is invalid. The package broadcast ensures atomicity.

## What Happens After

Once both transactions confirm:

- The seller has their BTC
- The Ordinal sits in liquidium loan escrow
- The buyer has a loan with a fixed expiry (7-30 days)

- **Repayment:** If the buyer repays before expiry, the Ordinal releases to them.
- **Default:** If they don't, the lender claims it. The buyer loses their down payment.

## Plugging Into Existing Liquidity

A major advantage is that BNPL uses Liquidium's existing liquidity pool without requiring new lender infrastructure:

- **Unified Liquidity:** Lenders providing BTC for standard loans automatically support BNPL.
- **Same Risk Profile:** From a lender's perspective, it's just another Ordinal-backed loan.
- **Automatic Matching:** Liquidium handles matching and signing identical to standard loans.

---

Want to try it out? [**Check out BNPL on Satflow**](https://satflow.com).
