import {
  ASTVisitor,
  FragmentDefinitionNode,
  GraphQLError,
  Kind,
  SelectionSetNode,
  ValidationContext,
} from 'graphql';

// Rejects queries nested deeper than `max` before any resolver runs.
// Without it, `post { author { posts { author { ... } } } }` is a cheap DoS.
export function depthLimit(max: number) {
  return (context: ValidationContext): ASTVisitor => {
    const fragments = new Map<string, FragmentDefinitionNode>();
    for (const def of context.getDocument().definitions) {
      if (def.kind === Kind.FRAGMENT_DEFINITION)
        fragments.set(def.name.value, def);
    }

    const depthOf = (
      set: SelectionSetNode,
      depth: number,
      seen: Set<string>,
    ): number => {
      let deepest = depth;
      for (const sel of set.selections) {
        if (sel.kind === Kind.FIELD) {
          if (sel.selectionSet)
            deepest = Math.max(
              deepest,
              depthOf(sel.selectionSet, depth + 1, seen),
            );
        } else if (sel.kind === Kind.INLINE_FRAGMENT) {
          deepest = Math.max(deepest, depthOf(sel.selectionSet, depth, seen));
        } else {
          const name = sel.name.value;
          const frag = fragments.get(name);
          if (frag && !seen.has(name)) {
            deepest = Math.max(
              deepest,
              depthOf(frag.selectionSet, depth, new Set(seen).add(name)),
            );
          }
        }
      }
      return deepest;
    };

    return {
      OperationDefinition(node) {
        const depth = depthOf(node.selectionSet, 1, new Set());
        if (depth > max) {
          context.reportError(
            new GraphQLError(
              `Query depth ${depth} exceeds the limit of ${max}`,
              { nodes: [node] },
            ),
          );
        }
      },
    };
  };
}
