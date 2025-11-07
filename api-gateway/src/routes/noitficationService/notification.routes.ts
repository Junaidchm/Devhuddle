// // api-gateway/src/routes/notifications/notification.routes.ts
// import { Router } from 'express';
// import jwtMiddleware from 'middleware/jwt.middleware';
// import { notificationServiceProxy } from 'middleware/notification.proxy.middleware';


// const router = Router();

// // Apply JWT middleware to all notification routes
// router.use(jwtMiddleware);

// router
//   .get('/', notificationServiceProxy)
//   .get('/:recipientId', notificationServiceProxy)
//   .patch('/:id/read', notificationServiceProxy)
//   .delete('/:id', notificationServiceProxy)
//   .get('/:recipientId/unread-count', notificationServiceProxy);

// export default router;