# SortedIMT

SortedIMT is an optimized Incremental Merkle Tree designed to support efficient membership and non-membership proofs.

Inspired by:
- Sorted Merkle Tree 
- Indexed Merkle Tree
- LeanIMT 

The result is a simple structure that allows:
- Efficient incremental insertions
- Compact membership proofs
- Efficient non-membership proofs
- Post-quantum safety (assuming the underlying hash function is post-quantum secure)

## Motivation

Traditional Merkle Trees are efficient for membership proofs, but they do not natively support non-membership proofs.

SortedIMT combines the advantages of these approaches by introducing a sorted structure while preserving the incremental efficiency of LeanIMT.

## Overview

SortedIMT is a sorted incremental Merkle tree where:
- Leaves are sorted by their values
- Each leaf stores two fields: `(value, nextValue)`
This structure behaves similarly to a linked list embedded in a Merkle tree.
- Each leaf commits to its values: `leafHash = H(value, nextValue)`
The tree is then built using the LeanIMT construction starting from these leaf commitments.

Rules:

- 0 is not a valid value
- 0 is used only as a sentinel
- The last leaf always has nextValue = 0

## Auxiliary Node

The first node in the tree is always an auxiliary node:
value = 0
nextValue = firstElement

This node allows generating non-membership proofs for values smaller than the smallest element.

Example:

```
[0, 5] [5, 10] [10, 20] [20, 0]
```

## Construction

1. Each leaf commits to its values: `leafHash = H(value, nextValue)`

2. These hashes form the base layer of the tree.

3. Parent nodes follow the LeanIMT construction: `parent = H(leftChild, rightChild)`

This produces the final Merkle root.

![SortedIMT](images/sorted-imt.png)

## Insertion

To insert a new value N:

1. Locate position

Use binary search to find the largest value < N.

2. Insert leaf

Insert a new leaf after the found leaf.

Example:

```
before

[5, 10]

insert 7

after

[5, 7] [7, 10]
```

3. Update indices

Update the nextValue of the previous leaf.

4. Recompute hashes

Recompute:

- the modified leaf hash

- parent hashes up to the root

![Insert](images/insert.png)

## Membership Proof

To prove membership of value N:

1. Use binary search to locate the leaf containing `value = N`.

2. Generate a standard Merkle proof using the LeanIMT structure.

The verifier checks:

- The Merkle path

- The leaf contains `value = N`

![Membership Proof](images/membership-proof.png)

## Non-Membership Proof

To prove that value N is not in the tree:

1. Find predecessor

Use binary search to find the largest value `< N`.

Let this leaf be: `(value, nextValue)`

2. Generate proof

Generate a Merkle proof for that leaf.

3. Verifier checks

The verifier validates:
- The Merkle proof
- The ordering condition: `value < N < nextValue`
If this holds, N cannot exist in the tree.

![Non-Membership Proof](images/non-membership-proof.png)

## Live App

A live app is available to experiment with the SortedIMT data structure and check benchmarks: 

The app allows you to:
- Insert new values into the tree
- Generate Merkle Proof
- Verify Merkle Proof

## Implementation

The reference implementation of SortedIMT is available in this repository in [sorted-imt](./browser/sorted-imt/).

The implementation includes:
- SortedIMT data structure
- Incremental insertion algorithm
- Membership and Non-Membership proof generation
- Membership and Non-Membership proof verification