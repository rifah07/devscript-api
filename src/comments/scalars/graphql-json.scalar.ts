import { GraphQLScalarType, Kind, ValueNode } from 'graphql';

// A minimal, properly-typed JSON scalar — parses/serializes arbitrary JSON.
// This replaces graphql-type-json entirely, avoiding its untyped export.
function parseAstValue(ast: ValueNode): unknown {
  switch (ast.kind) {
    case Kind.STRING:
    case Kind.BOOLEAN:
      return ast.value;
    case Kind.INT:
    case Kind.FLOAT:
      return Number(ast.value);
    case Kind.OBJECT: {
      const value: Record<string, unknown> = {};
      ast.fields.forEach((field) => {
        value[field.name.value] = parseAstValue(field.value);
      });
      return value;
    }
    case Kind.LIST:
      return ast.values.map((v) => parseAstValue(v));
    case Kind.NULL:
      return null;
    default:
      return undefined;
  }
}

export const GraphQLJSON = new GraphQLScalarType({
  name: 'JSON',
  description:
    'Arbitrary JSON value — used for endpoints returning unstructured data like account exports.',
  serialize(value: unknown): unknown {
    // Value going OUT to the client — pass through as-is
    return value;
  },
  parseValue(value: unknown): unknown {
    // Value coming IN from a client variable — pass through as-is
    return value;
  },
  parseLiteral(ast: ValueNode): unknown {
    // Value coming IN written directly in the GraphQL query string
    return parseAstValue(ast);
  },
});
