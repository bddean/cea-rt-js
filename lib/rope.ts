/*
Notes on solution:

- I'm not 100% confident in the balance operation. Though it may be
  at least probabalistically correct. (Not going to attempt to fix that
  spelling...).

- Ideal solution would also find a way to compute `size` dynamically.

- All the operations I implemented. return copies.

- I wrote most of the implementation code on top of the MapRepresentation,
  but kept the class-based representations as a "view" into the data.
  In production code, if we took this route, we'd want to modify the
  classes so they don't allocate any more memory - but just act as a
  view layer on top of the underlying data.

- There's lots of repeated code where "right" is substituted for "left"
  and vice versa. More general way of expressing "direction" would be nice.
*/

type MapBranch = {
  balanced?: boolean,
  left?: MapRepresentation,
  right?: MapRepresentation,
  size: number,
  kind: 'branch'
}
type MapLeaf = {
  text: string,
  kind: 'leaf'
}
type MapRepresentation = MapBranch | MapLeaf

interface IRope {
  toString: () => string,
  size: () => number,
  height: () => number,
  toMap: () => MapRepresentation,
  isBalanced: () => Boolean
}

export class RopeLeaf implements IRope {
  text: string;

  // Note: depending on your implementation, you may want to to change this constructor
  constructor(text: string) {
    this.text = text;
  }

  // just prints the stored text
  toString(): string {
    return this.text
  }

  size() {
    return this.text.length;
  }

  height() {
    return 1;
  }

  toMap(): MapLeaf {
    return {
      text: this.text,
      kind: 'leaf'
    }
  }

  isBalanced() {
    return true;
  }
}

export class RopeBranch implements IRope {
  left: IRope;
  right: IRope;
  cachedSize: number;

  constructor(left: IRope, right: IRope) {
    this.left = left;
    this.right = right;
    // Please note that this is defined differently from "weight" in the Wikipedia article.
    // You may wish to rewrite this property or create a different one.
    this.cachedSize = (left ? left.size() : 0) +
      (right ? right.size() : 0)
  }

  // how deep the tree is (I.e. the maximum depth of children)
  height(): number {
    return 1 + Math.max(this.leftHeight(), this.rightHeight())
  }
 
  // Please note that this is defined differently from "weight" in the Wikipedia article.
  // You may wish to rewrite this method or create a different one.
  size() {
    return this.cachedSize;
  }

  /*
    Whether the rope is balanced, i.e. whether any subtrees have branches
    which differ by more than one in height.
  */
  isBalanced(): boolean {
    const leftBalanced = this.left ? this.left.isBalanced() : true
    const rightBalanced = this.right ? this.right.isBalanced() : true

    return leftBalanced && rightBalanced
      && Math.abs(this.leftHeight() - this.rightHeight()) < 2
  }

  leftHeight(): number {
    if (!this.left) return 0
    return this.left.height()
  }

  rightHeight(): number {
    if (!this.right) return 0
    return this.right.height()
  }

  // Helper method which converts the rope into an associative array
  //
  // Only used for debugging, this has no functional purpose
  toMap(): MapBranch {
    const mapVersion: MapBranch = {
      size: this.size(),
      kind: 'branch'
    }
    if (this.right) mapVersion.right = this.right.toMap()
    if (this.left) mapVersion.left = this.left.toMap()
    return mapVersion
  }

  toString(): string {
    return (this.left ? this.left.toString() : '')
      + (this.right ? this.right.toString() : '')
  }
}

export function createRopeFromMap(map: MapRepresentation): IRope {
  if (map.kind == 'leaf') {
    return new RopeLeaf(map.text)
  }

  let left, right = null;
  if (map.left) left = createRopeFromMap(map.left)
  if (map.right) right = createRopeFromMap(map.right)
  return new RopeBranch(left, right);
}



const empty = { kind: 'leaf', text: '' };
// Compute "size" for MapRepresentation.
const mSize = (n?: MapRepresentation) => {
  if (! n) return 0;
  if (n.kind == 'leaf') return n.text.length;
  return n.size;
}

function splitMap(
  rope: MapRepresentation|undefined,
  position: number
): {left: MapRepresentation, right: MapRepresentation} {
  // Empty nodes.
  if (! rope) return { left: empty, right: empty };
  // Leaf nodes.
  if (rope.kind == 'leaf') {
    return {
      left: {kind: 'leaf', text: rope.text.substring(0, position) },
      right: {kind: 'leaf', text: rope.text.substring(position) },
    }
  }
  // Out of bounds.
  if (position < 0) return { left: empty, right: rope };
  if (position >= rope.size) return { left: rope, right: empty };

  const lSize = mSize(rope.left);
  const rSize = mSize(rope.right);
  if (position > lSize) {
    const splat = splitMap(rope.right, position - lSize);
    return {
      right: splat.right,
      left: {
        ...rope,
        size: rope.size - position,
        right: splat.left
      }
    }
  }
  const splat = splitMap(rope.left, position);
  return {
    left: splat.left,
    right: {
      ...rope,
      size: rope.size - position,
      left: splat.right
    }
  }
}

export function insertMap(rope: MapRepresentation, text: string, location: number): MapRepresentation {
  // TODO
  const split = splitMap(rope, location);
  return {
    kind: 'branch',
    size: text.length + mSize(rope),
    left: {
       left: split.left,
       right: {
         kind: 'leaf',
         text,
       }
    },
    right: split.right,
  }
}

export function deleteMap(rope: MapRepresentation, start: number, end: number): MapRepresentation {
  const startSplit = splitMap(rope, start);
  const endSplit = splitMap(rope, end);
  if (end === undefined) {
    console.warn(new Error().stack);
  }
  return {
    kind: 'branch',
    size: rope.size - (end-start),
    left: startSplit.left,
    right: endSplit.right,
  };
}

function rotateRight(rope: MapRepresentation): MapRepresentation {
  if (! rope.left) return rope;
  return {
    ...rope.left,
    size: rope.size,
    right: {
       ...rope,
       size: rope.size - mSize(rope.left) + mSize(rope?.left?.right),
       left: rope?.left?.right
    }
  }
}

function rotateLeft(rope: MapRepresentation): MapRepresentation {
  if (! rope.right) return rope;
  return {
    ...rope.right,
    size: rope.size,
    left: {
       ...rope,
       size: rope.size - mSize(rope.right) + mSize(rope?.right?.left),
       right: rope?.right?.left
    }
  };
}

const imbalance = (r: MapRepresentation) => Math.abs(mSize(r.left) - mSize(r.right));

function balanceMap(rope: MapRepresentation, rec=false): MapRepresentation {
  if (! rope || rope.kind == 'leaf' || rope.balanced) return rope;
  const left = balanceMap(rope.left);
  const right = balanceMap(rope.right);
  rope = { ... rope, left, right};
  while (true) {
    let next;
    if (mSize(rope.left) > mSize(rope.right)) {
      next = rotateRight(rope);
    } else {
      next = rotateLeft(rope);
    }
    if (imbalance(rope) <= imbalance(next)) {
      break;
    }
    rope = next;
  }
  rope.balanced = true; // Safe because this is a clone.
  return rope;
}

// This is an internal API. You can implement it however you want.
// (E.g. you can choose to mutate the input rope or not)
//
// Visisble for testing.
export function splitAt(rope: IRope, position: number): { left: IRope, right: IRope } {
  const { left, right } = splitMap(rope.toMap(), position);
  return {
    left: createRopeFromMap(left),
    right: createRopeFromMap(right)
  };
}


///////////
// External APIs.
///////////
export function deleteRange(rope: IRope, start: number, end: number): IRope {
  return createRopeFromMap(
    deleteMap(rope.toMap(), start, end)
  );
}

export function insert(rope: IRope, text: string, location: number): IRope {
  return createRopeFromMap(insertMap(rope.toMap(), text, location));
}

export function rebalance(rope: IRope): IRope {
  const map = balanceMap(rope.toMap());
  return createRopeFromMap(map);
}
