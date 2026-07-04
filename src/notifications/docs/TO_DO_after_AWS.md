## To Do — After AWS Deployment

- [ ] 1. Uncomment `NotificationsGateway` in `notifications.module.ts` providers
- [ ] 2. Uncomment `JwtModule` in `notifications.module.ts` imports
- [ ] 3. Uncomment gateway injection in `notifications.service.ts` constructor
- [ ] 4. Uncomment all `pushToUser()` calls in `notifications.service.ts`
- [ ] 5. Uncomment private `pushToUser()` method in `notifications.service.ts`
- [ ] 6. Set `FRONTEND_URL` env var on your AWS instance
- [ ] 7. Configure Nginx with WebSocket proxy headers (see gateway comments)
- [ ] 8. Open port `3000` in AWS Security Group
- [ ] 9. If scaling horizontally: add Redis adapter (see gateway comments)
- [ ] 10. Connect frontend using the hook in `FRONTEND_WEBSOCKET_GUIDE.ts`