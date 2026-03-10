export type SortedIMTLeaf<N = bigint> = [value: N, nextValue: N]

export type NodeHashFunction<N = bigint> = (a: N, b: N) => N

export type SortedIMTMerkleProof<
  N = bigint,
  L extends SortedIMTLeaf<N> = SortedIMTLeaf<N>
> = {
  root: N
  leaf: L
  index: number
  siblings: N[]
}

export type SortedIMTProofResult<
  N = bigint,
  L extends SortedIMTLeaf<N> = SortedIMTLeaf<N>
> = {
  proofType: 0 | 1
  value: N
  proof: SortedIMTMerkleProof<N, L>
}
