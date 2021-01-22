const { TraversalContext } = require('@babel/traverse');

export type TraverseState = TraversalContext &{
  isChinese: boolean;
}
