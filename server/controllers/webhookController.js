// server/controllers/webhookController.js
import { sendMessage, deleteMessage, getMediaUrl } from '../services/WhatsappService.js';
import { supabase } from '../config/database.js';
import logger from '../utils/logger.js';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create temp directory if it doesn't exist
const tempDir = path.join(__dirname, '../temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Handle webhook verification from Meta
export const verifyWebhook = async (req, res) => {
  try {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    console.log('Webhook verification attempt:', {
      mode,
      token,
      challenge,
      expectedToken: process.env.WHATSAPP_VERIFY_TOKEN,
      matches: token === process.env.WHATSAPP_VERIFY_TOKEN
    });

    if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      console.log('Sending challenge response:', challenge);
      
      // Set only essential headers and send challenge
      res.set('Content-Type', 'text/plain');
      return res.send(String(challenge));
    }

    console.log('Verification failed - sending 403');
    return res.sendStatus(403);
  } catch (error) {
    console.error('Webhook error:', error);
    return res.sendStatus(500);
  }
};


// Handle incoming messages
export const receiveMessage = async (req, res) => {
  try {
    const { body } = req;
    logger.info(`📥 Received webhook payload`, { object: body.object });
    
    if (body.object === 'whatsapp_business_account') {
      if (body.entry && 
          body.entry[0].changes && 
          body.entry[0].changes[0] && 
          body.entry[0].changes[0].value.messages && 
          body.entry[0].changes[0].value.messages[0]
      ) {
        const messageData = body.entry[0].changes[0].value.messages[0];
        logger.info(`📥 Processing message`, { 
          type: messageData.type,
          from: messageData.from 
        });
        const phone = messageData.from;
        
        // Check if lead exists
        let { data: lead, error: leadQueryError } = await supabase
          .from('leads')
          .select('*')
          .eq('phone', phone)
          .single();

        if (leadQueryError) {
          logger.error('❌ Error querying lead:', leadQueryError);
        }

        // Store the message with appropriate lead information
        const timestamp = messageData.timestamp 
          ? new Date(messageData.timestamp * 1000)
          : new Date();

        if (!lead) {
          // Create new lead only if it doesn't exist
          const currentDate = new Date();
          
          const { data: newLead, error: createError } = await supabase
          .from('leads')
          .insert([{
            name: `WhatsApp Lead (${phone})`,
            phone: phone,
            email: `${phone}@gmail.com`,        // Unique email using phone
            assigned_user: 1,                    // Default assigned user
            lead_source_id: 7,                   // WhatsApp source
            lead_stage: 1,                       // Initial stage
            lead_product: 1,                     // Default product
            branch_id: 1,                        // Default branch
            lead_active_status: true,
            fu_date: currentDate,
            fu_hour: 10,                         // Default follow-up hour
            fu_minutes: 0,                       // Default follow-up minutes
            fu_period: 'AM',                     // Default period
            initial_remarks: 'Lead created through WhatsApp messages',
            closed_at: null,                     // Keep null as not shown in ChatList
            won_at: null,                        // Keep null as not shown in ChatList
            created_at: currentDate,
            updated_at: currentDate
          }])
          .select()
          .single();

          if (createError) {
            throw createError;
          }
          
          lead = newLead;
        }

        // Handle different message types and get content
        let messageContent = null;
        let mediaUrl = null;

        switch (messageData.type) {
          case 'text':
            messageContent = messageData.text?.body;
            logger.info(`📝 Received text message`, { content: messageContent });
            break;
          case 'audio':
            logger.info(`🎵 Received audio message`, { mediaId: messageData.audio.id });
            mediaUrl = await getMediaUrl(messageData.audio.id);
            messageContent = '[Audio Message]';
            break;
          case 'document':
            try {
              logger.info(`📎 Received document`, { 
                mediaId: messageData.document.id,
                filename: messageData.document.filename 
              });
              
              mediaUrl = await getMediaUrl(messageData.document.id);
              messageContent = `[Document: ${messageData.document.filename || 'Unnamed'}]`;
              
              const { error: messageError } = await supabase
                .from('messages')
                .insert([{
                  lead_id: lead.id,
                  phone: phone,
                  message: messageContent,
                  media_url: mediaUrl,
                  type: 'document',
                  timestamp: timestamp.toISOString(),
                  is_outgoing: false
                }]);

              if (messageError) {
                logger.error(`❌ Error storing document message:`, messageError);
                throw messageError;
              }

              // Send socket event with document info
              const socketData = {
                ...messageData,
                leadId: lead.id,
                name: lead.name,
                assigned_user: lead.assigned_user,
                media_url: mediaUrl,
                type: 'document'
              };
              req.app.io.emit('new_whatsapp_message', socketData);
              return res.sendStatus(200);

            } catch (error) {
              logger.error(`❌ Error processing document:`, error);
              throw error;
            }
            break;
          default:
            messageContent = `[${messageData.type} Message]`;
            logger.info(`📥 Received other message type`, { type: messageData.type });
        }

        // Log message storage
        logger.info(`�� Storing message in database`, {
          leadId: lead.id,
          type: messageData.type,
          hasMedia: !!mediaUrl
        });

        // Store the message
        const { error: messageError } = await supabase
          .from('messages')
          .insert([{
            lead_id: lead.id,
            phone: phone,
            message: messageContent,
            media_url: mediaUrl,
            timestamp: timestamp.toISOString(),
            is_outgoing: false
          }]);

        if (messageError) {
          throw messageError;
        }

        // After storing the message, get accurate unread count for this chat
        const { count: unreadCount } = await supabase
          .from('messages')
          .select('*', { count: 'exact' })
          .eq('lead_id', lead.id)
          .eq('is_read', false)
          .eq('is_outgoing', false);

        // Get total unread counts for tabs
        const { data: chats, error: countError } = await supabase
          .from('leads')
          .select(`
            id,
            assigned_user,
            messages!inner (
              id,
              is_read,
              is_outgoing
            )
          `)
          .eq('messages.is_read', false)
          .eq('messages.is_outgoing', false);

        if (!countError) {
          const counts = {
            unassigned: 0,
            mine: 0,
            perChat: {}
          };

          // Count unique chats for each category
          const processedChats = new Set();
          
          chats.forEach(chat => {
            if (!processedChats.has(chat.id)) {
              if (chat.assigned_user === null) {
                counts.unassigned++;
              } else if (chat.assigned_user === lead.assigned_user) {
                counts.mine++;
              }
              processedChats.add(chat.id);
            }
          });

          // Set accurate unread count for this specific chat
          counts.perChat[lead.id] = unreadCount;

          // Emit socket event with updated counts
          req.app.io.emit('unread_counts_update', counts);
        }

        // Emit socket event with lead info and unread count
        const socketData = {
          ...messageData,
          leadId: lead.id,
          name: lead.name,
          assigned_user: lead.assigned_user,
          unreadCount: unreadCount // Add accurate unread count
        };
        req.app.io.emit('new_whatsapp_message', socketData);
      }
    }
    res.sendStatus(200);
  } catch (error) {
    logger.error(`❌ Error processing webhook: ${error.message}`, { error });
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get messages for a lead
export const getMessages = async (req, res) => {
  try {
    const { leadId } = req.params;
    
    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .eq('lead_id', leadId)
      .order('timestamp', { ascending: true });

    if (error) throw error;

    res.status(200).json({
      success: true,
      data: messages
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Send a reply to a message
export const replyMessage = async (req, res) => {
  const { recipient, text } = req.body;
  try {
    if (!recipient || !text) {
      return res.status(400).json({ 
        success: false, 
        error: 'Recipient and text are required' 
      });
    }

    const response = await sendMessage(recipient, text);
    const timestamp = Math.floor(Date.now() / 1000); // Current server timestamp

    // Store the outgoing message
    const { data: messageData, error: messageError } = await supabase
      .from('messages')
      .insert([{
        lead_id: req.body.leadId,
        phone: recipient,
        message: text,
        timestamp: new Date(),
        is_outgoing: true
      }])
      .select()
      .single();

    if (messageError) {
      logger.error('❌ Error storing outgoing message:', messageError);
    }

    res.status(200).json({ 
      success: true, 
      data: response,
      timestamp: timestamp,
      messageId: messageData?.id
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};

// Add this new controller function
export const getLastMessageTime = async (req, res) => {
  try {
    const { chatId } = req.params;
    
    const { data: messages, error } = await supabase
      .from('messages')
      .select('timestamp, message')  // Also select the message content
      .eq('lead_id', chatId)
      .order('timestamp', { ascending: false })
      .limit(1);

    if (error) throw error;

    const lastMessage = messages && messages.length > 0 ? {
      timestamp: messages[0].timestamp,
      message: messages[0].message?.substring(0, 30) + '...' // Truncate message to first 30 chars
    } : null;

    res.status(200).json({
      success: true,
      ...lastMessage
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};

// Get filtered chats with strict filtering
export const getFilteredChats = async (req, res) => {
  try {
    const { filter, searchQuery } = req.query;
    const { user_id } = req.query;

    let query = supabase
      .from('leads')
      .select(`
        *,
        users!leads_assigned_user_fkey (
          id,
          name,
          role_id,
          user_is_active
        ),
        messages (
          message,
          timestamp,
          is_outgoing
        )
      `);

    // Apply search filter if provided
    if (searchQuery) {
      query = query.or(`name.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`);
    }

    // Apply existing filters
    switch (filter) {
      case 'unassigned':
        query = query.is('assigned_user', null);
        break;
      case 'mine':
        query = query.eq('assigned_user', user_id);
        break;
      case 'open':
        query = query.eq('lead_active_status', true);
        break;
      case 'resolved':
        query = query.eq('lead_active_status', false);
        break;
    }

    query = query.order('updated_at', { ascending: false });
    const { data: chats, error } = await query;

    if (error) throw error;

    res.status(200).json({
      success: true,
      data: chats
    });

  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};

// Add new endpoint to track unread messages per tab
export const getUnreadChatCounts = async (req, res) => {
  try {
    const { user_id } = req.query;
    
    // Get all chats with their unread messages
    const { data: chats, error: chatsError } = await supabase
      .from('leads')
      .select(`
        id,
        assigned_user,
        messages (
          id,
          is_read,
          is_outgoing
        )
      `);

    if (chatsError) throw chatsError;

    // Initialize counts object
    const counts = {
      unassigned: 0,
      mine: 0,
      perChat: {}
    };

    // Use Promise.all instead of forEach for async operations
    await Promise.all(chats.map(async (chat) => {
      // Get unread message count for this chat
      const { count: unreadCount, error: countError } = await supabase
        .from('messages')
        .select('*', { count: 'exact' })
        .eq('lead_id', chat.id)
        .eq('is_read', false)
        .eq('is_outgoing', false);

      if (!countError && unreadCount > 0) {
        counts.perChat[chat.id] = unreadCount;
        
        if (chat.assigned_user === null) {
          counts.unassigned++;
        } else if (chat.assigned_user === parseInt(user_id)) {
          counts.mine++;
        }
      }
    }));

    res.status(200).json({
      success: true,
      data: counts
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Add new function to mark messages as read
export const markMessagesAsRead = async (req, res) => {
  try {
    const { leadId } = req.params;
    const { user_id } = req.query;

    // Update all unread messages for this lead to read
    const { error: updateError } = await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('lead_id', leadId)
      .eq('is_outgoing', false)
      .eq('is_read', false);

    if (updateError) throw updateError;

    // Get all chats with unread messages
    const { data: chats, error: chatsError } = await supabase
      .from('leads')
      .select(`
        id,
        assigned_user,
        messages (
          id,
          is_read,
          is_outgoing
        )
      `);

    if (chatsError) throw chatsError;

    // Initialize counts
    const counts = {
      unassigned: 0,
      mine: 0,
      perChat: {}
    };

    // Use Promise.all for async operations
    await Promise.all(chats.map(async (chat) => {
      const { count: unreadCount, error: countError } = await supabase
        .from('messages')
        .select('*', { count: 'exact' })
        .eq('lead_id', chat.id)
        .eq('is_read', false)
        .eq('is_outgoing', false);

      if (!countError && unreadCount > 0) {
        counts.perChat[chat.id] = unreadCount;
        
        if (chat.assigned_user === null) {
          counts.unassigned++;
        } else if (chat.assigned_user === parseInt(user_id)) {
          counts.mine++;
        }
      }
    }));

    // Emit updated counts via socket
    req.app.io.emit('unread_counts_update', counts);

    res.status(200).json({
      success: true,
      data: counts
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Add this new controller function for handling media uploads
export const sendMedia = async (req, res) => {
  let tempFilePath = null;
  
  try {
    if (!req.files || !req.files.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const file = req.files.file;
    const { recipient, mediaType, leadId } = req.body;

    logger.info(`📤 Attempting to send ${mediaType} to ${recipient}`, { 
      filename: file.name,
      mimeType: file.mimetype 
    });

    // Create a safe temp file path using path.join
    tempFilePath = path.join(tempDir, `${Date.now()}-${file.name}`);
    
    // Move file to temporary location
    await file.mv(tempFilePath);

    try {
      // Create form data
      const form = new FormData();
      form.append('file', fs.createReadStream(tempFilePath));
      form.append('messaging_product', 'whatsapp');
      form.append('type', file.mimetype);

      // Upload to WhatsApp
      const uploadResponse = await axios.post(
        `${process.env.WHATSAPP_API_URL}/${process.env.WHATSAPP_NUMBER_ID}/media`,
        form,
        {
          headers: {
            'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
            ...form.getHeaders()
          }
        }
      );

      const mediaId = uploadResponse.data.id;

      // Send media message
      const messageResponse = await axios.post(
        `${process.env.WHATSAPP_API_URL}/${process.env.WHATSAPP_NUMBER_ID}/messages`,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: recipient,
          type: mediaType,
          [mediaType]: {
            id: mediaId
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );

      // Store the message in database
      const { data: messageData, error: messageError } = await supabase
        .from('messages')
        .insert([{
          lead_id: leadId,
          phone: recipient,
          message: `[${mediaType === 'document' ? 'Document' : 'Audio'}: ${file.name}]`,
          media_url: uploadResponse.data.url,
          timestamp: new Date(),
          is_outgoing: true,
          type: mediaType
        }])
        .select()
        .single();

      if (messageError) {
        logger.error('❌ Error storing outgoing media message:', messageError);
        throw messageError;
      }

      res.status(200).json({
        success: true,
        data: messageResponse.data,
        messageId: messageData?.id
      });

    } catch (error) {
      logger.error(`❌ Error in media handling: ${error.message}`, { error });
      throw error;
    }

  } catch (error) {
    logger.error(`❌ Error sending media message: ${error.message}`, { error });
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    // Clean up temp file
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
  }
};

// Helper function to upload media to WhatsApp
const uploadMedia = async (filePath, mimeType) => {
  try {
    logger.info(`📤 Uploading media file`, { mimeType });
    
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));
    form.append('messaging_product', 'whatsapp');
    form.append('type', mimeType);

    const response = await axios.post(
      `${process.env.WHATSAPP_API_URL}/${process.env.WHATSAPP_NUMBER_ID}/media`,
      form,
      {
        headers: {
          'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
          ...form.getHeaders()
        }
      }
    );

    return response.data.id;
  } catch (error) {
    logger.error(`❌ Error uploading media: ${error.message}`, { error });
    throw error;
  }
};

// Helper function to send media message
const sendMediaMessage = async (recipient, mediaId, mediaType) => {
  try {
    const messageData = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipient,
      type: mediaType,
      [mediaType]: {
        id: mediaId
      }
    };

    const response = await axios.post(
      `${process.env.WHATSAPP_API_URL}/${process.env.WHATSAPP_NUMBER_ID}/messages`,
      messageData,
      {
        headers: {
          'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data;
  } catch (error) {
    logger.error(`❌ Error sending media message: ${error.message}`, { error });
    throw error;
  }
};




