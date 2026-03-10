import SortedIMT from "../src/sorted-imt"

const hash = (a: bigint, b: bigint): bigint => a + b

function computeRootFromLeaves(leaves: [bigint, bigint][]): bigint {
  let level = leaves.map(([value]) => value)
  let treeLevel = 0

  while (level.length > 1) {
    const nextLevel: bigint[] = []

    for (let i = 0; i < level.length; i += 2) {
      const left = level[i]

      if (i + 1 < level.length) {
        const right = level[i + 1]
        nextLevel.push(hash(left, right))
      } else if (treeLevel === 0) {
        nextLevel.push(leaves[i][0])
      } else {
        nextLevel.push(left)
      }
    }

    level = nextLevel
    treeLevel += 1
  }

  return level[0]
}

describe("SortedIMT", () => {
  test("first insert creates sentinel and first linked leaf", () => {
    const tree = new SortedIMT<bigint>(hash)

    tree.insert(5n)

    expect(tree.leaves).toEqual([[5n, 0n]])
    expect(tree.size).toBe(2)
    expect(tree.depth).toBe(1)
    expect(tree.root).toBe(computeRootFromLeaves(tree.leaves))
  })

  test("keeps leaves sorted and updates successor pointers", () => {
    const tree = new SortedIMT<bigint>(hash)

    tree.insert(10n)
    tree.insert(30n)
    tree.insert(20n)

    expect(tree.leaves).toEqual([
      [10n, 20n],
      [20n, 30n],
      [30n, 0n]
    ])
    expect(tree.indexOf(20n)).toBe(2)
    expect(tree.has(25n)).toBe(false)
    expect(tree.has(30n)).toBe(true)
  })

  test("ignores duplicate values", () => {
    const tree = new SortedIMT<bigint>(hash)

    tree.insert(10n)
    tree.insert(20n)
    tree.insert(20n)

    expect(tree.leaves).toEqual([
      [10n, 20n],
      [20n, 0n]
    ])
    expect(tree.size).toBe(3)
  })

  test("promotes single child when parent level has odd node count", () => {
    const tree = new SortedIMT<bigint>(hash)

    tree.insert(10n)
    tree.insert(20n)

    expect(tree.size).toBe(3)
    expect(tree.depth).toBe(2)
    expect(tree.root).toBe(computeRootFromLeaves(tree.leaves))
  })

  test("promotes only child at an intermediate level even when leaf count is even", () => {
    const tree = new SortedIMT<bigint>(hash)

    tree.insert(10n)
    tree.insert(20n)
    tree.insert(30n)
    tree.insert(40n)
    tree.insert(50n)

    // Leaves include sentinel, so this creates 6 leaves (even), but level-1 has 3 nodes (odd).
    expect(tree.size).toBe(6)
    expect(tree.root).toBe(computeRootFromLeaves(tree.leaves))
  })

  test("generates membership proof for an existing value", () => {
    const tree = new SortedIMT<bigint>(hash)

    tree.insert(10n)
    tree.insert(20n)
    tree.insert(30n)

    const result = tree.generateMembershipProof(20n)

    expect(result.proofType).toBe(0)
    expect(result.value).toBe(20n)
    expect(result.proof.root).toBe(tree.root)
    expect(result.proof.leaf).toEqual([20n, 30n])
    expect(result.proof.index).toBe(1)
    expect(result.proof.siblings).toEqual([10n, 30n])
    expect(tree.verifyProof(result)).toBe(true)
  })

  test("generates non-membership proof and returns queried value", () => {
    const tree = new SortedIMT<bigint>(hash)

    tree.insert(10n)
    tree.insert(20n)
    tree.insert(30n)

    const result = tree.generateNonMembershipProof(25n)

    expect(result.proofType).toBe(1)
    expect(result.value).toBe(25n)
    expect(result.proof.root).toBe(tree.root)
    expect(result.proof.leaf).toEqual([20n, 30n])
    expect(result.proof.index).toBe(1)
    expect(result.proof.siblings).toEqual([10n, 30n])
    expect(tree.verifyProof(result)).toBe(true)
  })

  test("membership verification fails when value does not match proof leaf", () => {
    const tree = new SortedIMT<bigint>(hash)

    tree.insert(10n)
    tree.insert(20n)
    tree.insert(30n)

    const result = tree.generateMembershipProof(20n)

    expect(tree.verifyProof({ ...result, value: 25n })).toBe(false)
  })

  test("non-membership verification fails outside proven range", () => {
    const tree = new SortedIMT<bigint>(hash)

    tree.insert(10n)
    tree.insert(20n)
    tree.insert(30n)

    const result = tree.generateNonMembershipProof(25n)

    expect(tree.verifyProof({ ...result, value: 20n })).toBe(false)
    expect(tree.verifyProof({ ...result, value: 30n })).toBe(false)
  })
})
