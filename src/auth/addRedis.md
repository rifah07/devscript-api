# Redis Migration Changes

Replace the database-based refresh token operations with Redis commands:

```ts
// Before
await this.refreshTokenModel.create(...)

// After
await redis.setex(key, ttlSeconds, '1')
```
