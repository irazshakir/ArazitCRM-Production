import express from 'express';
import { 
  receiveMessage, 
  replyMessage, 
  verifyWebhook,
  getMessages,
  getLastMessageTime,
  getFilteredChats,
  getUnreadChatCounts,
  markMessagesAsRead,
  sendMedia
} from '../controllers/webhookController.js';
import { uploadMedia } from '../services/WhatsappService.js';
import logger from '../utils/logger.js';

const router = express.Router();


router.get('/webhook/messages', verifyWebhook);
router.post('/webhook/messages', receiveMessage);

// Message management routes
router.post('/webhook/reply', replyMessage);
router.get('/webhook/messages/:leadId', getMessages);
router.get('/messages/last-message-time/:chatId', getLastMessageTime);
router.post('/webhook/messages/:leadId/read', markMessagesAsRead);

// Chat management routes
router.get('/webhook/filtered-chats', getFilteredChats);
router.get('/webhook/unread-counts', getUnreadChatCounts);

// Media handling routes
router.post('/webhook/send-media', sendMedia);

export default router;