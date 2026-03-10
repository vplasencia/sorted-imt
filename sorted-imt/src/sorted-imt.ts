import { requireArray, requireFunction, requireDefined } from "@zk-kit/utils"
import {
  NodeHashFunction,
  SortedIMTLeaf,
  SortedIMTMerkleProof,
  SortedIMTProofResult
} from "./types"

export default class SortedIMT<
  N extends bigint = bigint,
  L extends SortedIMTLeaf<N> = SortedIMTLeaf<N>
> {
  // Level 0 contains leaf hashes, upper levels contain internal node hashes.
  private _nodes: N[][]
  // Leaves are kept sorted by entry[0] and linked by entry[1] (successor value).
  private _leaves: L[]
  private readonly _hash: NodeHashFunction<N>

  constructor(nodeHash: NodeHashFunction<N>, leaves: L[] = []) {
    requireDefined(nodeHash, "nodeHash")
    requireFunction(nodeHash, "nodeHash")
    requireArray(leaves, "leaves")

    // Initialize the attributes.
    this._nodes = [[]]
    this._leaves = leaves.slice()
    this._hash = nodeHash
    this.rebuild()
  }

  public get root(): N {
    return this._nodes[this._nodes.length - 1][0]
  }

  public get depth(): number {
    return this._nodes.length
  }

  public get leaves(): L[] {
    return this._leaves.slice(1)
  }

  public get size(): number {
    return this._leaves.length
  }

  public indexOf(value: N): number {
    requireDefined(value, "value")

    return this._leaves.findIndex((entry) => entry[0] === value)
  }

  public has(value: N): boolean {
    requireDefined(value, "value")

    return this.indexOf(value) !== -1
  }

  public insert(value: N): void {
    requireDefined(value, "value")

    // This tree stores unique values.
    if (this.has(value)) {
      return
    }

    const zero = 0n as N

    // First insertion bootstraps the list with a sentinel head leaf [0, value].
    if (this._leaves.length === 0) {
      this._leaves.push([zero, value] as L)
      this._leaves.push([value, zero] as L)
      this.recalculateFrom(0)
      return
    }

    // Find sorted insertion point by comparing the first value of each leaf tuple.
    let insertIndex = this._leaves.length

    for (let i = 0; i < this._leaves.length; i += 1) {
      if (this._leaves[i][0] > value) {
        insertIndex = i
        break
      }
    }

    // The new leaf points to the next greater value, or 0 if it is the largest.
    const successor =
      insertIndex < this._leaves.length ? this._leaves[insertIndex][0] : zero
    const predecessorIndex = insertIndex - 1

    // Update predecessor's successor pointer to point to the inserted value.
    if (predecessorIndex >= 0) {
      const predecessor = this._leaves[predecessorIndex]
      this._leaves[predecessorIndex] = [predecessor[0], value] as L
    }

    // Insert leaf while preserving sorted order.
    this._leaves.splice(insertIndex, 0, [value, successor] as L)

    // Recompute only affected hashes starting from earliest changed leaf index.
    this.recalculateFrom(predecessorIndex >= 0 ? predecessorIndex : insertIndex)
  }

  public generateMembershipProof(value: N): SortedIMTProofResult<N, L> {
    requireDefined(value, "value")

    const leafIndex = this.indexOf(value)

    if (leafIndex <= 0) {
      throw new Error("The value is not part of the tree leaves")
    }

    return {
      proofType: 0,
      value,
      proof: this.createProofFromLeafIndex(leafIndex)
    }
  }

  public generateNonMembershipProof(value: N): SortedIMTProofResult<N, L> {
    requireDefined(value, "value")

    if (this._leaves.length <= 1) {
      throw new Error(
        "Cannot generate a non-membership proof for an empty tree"
      )
    }

    let predecessorIndex = -1

    for (let i = 1; i < this._leaves.length; i += 1) {
      if (this._leaves[i][0] < value) {
        predecessorIndex = i
      } else {
        break
      }
    }

    if (predecessorIndex === -1) {
      throw new Error("No predecessor leaf found for the provided value")
    }

    return {
      proofType: 1,
      value,
      proof: this.createProofFromLeafIndex(predecessorIndex)
    }
  }

  public verifyProof(result: SortedIMTProofResult<N, L>): boolean {
    requireDefined(result, "result")
    requireDefined(result.proofType, "result.proofType")
    requireDefined(result.value, "result.value")
    requireDefined(result.proof, "result.proof")

    if (this.reconstructRootFromProof(result.proof) !== result.proof.root) {
      return false
    }

    if (result.proofType === 0) {
      return result.proof.leaf[0] === result.value
    }

    if (result.proofType !== 1) {
      return false
    }

    const lowerBound = result.proof.leaf[0]
    const upperBound = result.proof.leaf[1]
    const zero = 0n as N

    if (result.value <= lowerBound) {
      return false
    }

    if (upperBound !== zero && result.value >= upperBound) {
      return false
    }

    return true
  }

  private rebuild(): void {
    // Full rebuild delegates to incremental recomputation from leaf index 0.
    if (this._leaves.length === 0) {
      this._nodes = [[]]
      return
    }

    this.recalculateFrom(0)
  }

  private recalculateFrom(startLeafIndex: number): void {
    if (this._leaves.length <= 1) {
      this._nodes = [[]]
      return
    }

    if (this._nodes.length === 0) {
      this._nodes = [[]]
    }

    const firstDataLeafIndex = 1
    const startIndex = Math.max(firstDataLeafIndex, startLeafIndex)
    const level0StartIndex = startIndex - firstDataLeafIndex

    if (!this._nodes[0]) {
      this._nodes[0] = []
    }

    // Recompute level-0 nodes from non-sentinel leaf first values.
    for (let i = startIndex; i < this._leaves.length; i += 1) {
      const leaf = this._leaves[i]
      this._nodes[0][i - firstDataLeafIndex] = leaf[0]
    }

    this._nodes[0].length = this._leaves.length - firstDataLeafIndex

    let level = 0
    // Parent index range affected at level 1 is floor(startIndex / 2), and so on.
    let levelStart = Math.floor(level0StartIndex / 2)

    while (this._nodes[level].length > 1) {
      const previousLevel = this._nodes[level]
      const nextLevelLength = Math.ceil(previousLevel.length / 2)

      if (!this._nodes[level + 1]) {
        this._nodes[level + 1] = []
      }

      const nextLevel = this._nodes[level + 1]

      // Recompute only affected parent segment for this level.
      for (let i = levelStart; i < nextLevelLength; i += 1) {
        const leftIndex = 2 * i
        const left = previousLevel[leftIndex]

        if (leftIndex + 1 < previousLevel.length) {
          const right = previousLevel[leftIndex + 1]
          nextLevel[i] = this._hash(left, right)
        } else if (level === 0) {
          // If a leaf hash has no right sibling, promote the leaf first value.
          nextLevel[i] = this._leaves[leftIndex + firstDataLeafIndex][0]
        } else {
          // If any intermediate node has no right sibling (this can happen even with an even leaf count),
          // promote its only child value unchanged.
          nextLevel[i] = left
        }
      }

      nextLevel.length = nextLevelLength
      level += 1
      levelStart = Math.floor(levelStart / 2)
    }

    // Drop stale upper levels when the tree gets shorter.
    this._nodes.length = level + 1
  }

  private createProofFromLeafIndex(
    leafIndex: number
  ): SortedIMTMerkleProof<N, L> {
    if (leafIndex <= 0 || leafIndex >= this._leaves.length) {
      throw new Error("Invalid leaf index for Merkle proof generation")
    }

    if (this._nodes.length === 0 || this._nodes[0].length === 0) {
      throw new Error("Cannot generate Merkle proofs from an empty tree")
    }

    const siblings: N[] = []
    let nodeIndex = leafIndex - 1

    for (let level = 0; level < this._nodes.length - 1; level += 1) {
      const siblingIndex = nodeIndex ^ 1

      if (siblingIndex < this._nodes[level].length) {
        siblings.push(this._nodes[level][siblingIndex])
      }

      nodeIndex = Math.floor(nodeIndex / 2)
    }

    return {
      root: this.root,
      leaf: this._leaves[leafIndex],
      index: leafIndex - 1,
      siblings
    }
  }

  private reconstructRootFromProof(proof: SortedIMTMerkleProof<N, L>): N {
    let node = proof.leaf[0]
    let nodeIndex = proof.index
    let siblingCursor = 0

    for (let level = 0; level < this._nodes.length - 1; level += 1) {
      const siblingIndex = nodeIndex ^ 1
      const hasSibling = siblingIndex < this._nodes[level].length

      if (hasSibling) {
        if (siblingCursor >= proof.siblings.length) {
          throw new Error("Invalid Merkle proof siblings")
        }

        const sibling = proof.siblings[siblingCursor]

        node =
          nodeIndex % 2 === 0
            ? this._hash(node, sibling)
            : this._hash(sibling, node)
        siblingCursor += 1
      }

      nodeIndex = Math.floor(nodeIndex / 2)
    }

    if (siblingCursor !== proof.siblings.length) {
      throw new Error("Invalid Merkle proof siblings")
    }

    return node
  }
}
