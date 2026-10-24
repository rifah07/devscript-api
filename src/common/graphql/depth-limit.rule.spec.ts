import { buildSchema, parse, validate } from 'graphql';
import { depthLimit } from './depth-limit.rule';

const schema = buildSchema(`
  type User { name: String posts: [Post] }
  type Post { title: String author: User }
  type Query { post: Post }
`);

const errorsFor = (query: string) =>
  validate(schema, parse(query), [depthLimit(3)]);

describe('depthLimit', () => {
  it('allows queries at the limit', () => {
    expect(errorsFor('{ post { author { name } } }')).toHaveLength(0);
  });

  it('rejects queries past the limit', () => {
    expect(errorsFor('{ post { author { posts { title } } } }')).toHaveLength(
      1,
    );
  });

  it('counts depth through fragments', () => {
    const q = `{ post { ...A } } fragment A on Post { author { posts { title } } }`;
    expect(errorsFor(q)).toHaveLength(1);
  });
});
