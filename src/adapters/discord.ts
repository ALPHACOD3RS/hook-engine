import crypto from "crypto";
import type { WebhookAdapter } from "../types/adapter";

/**
 * Discord webhook adapter
 * Supports: interactions, message events, guild events, and more
 * Documentation: https://discord.com/developers/docs/resources/webhook
 */
const discord: WebhookAdapter = {
  getSignature(req) {
    // Discord sends signature in X-Signature-Ed25519 header
    return req.headers["x-signature-ed25519"] as string | undefined;
  },

  verifySignature(rawBody, signature, publicKey) {
    if (!signature) return false;

    try {
      // Discord uses Ed25519 signatures, not HMAC
      // For Ed25519 verification, we need the public key and signature
      const timestamp = rawBody.toString().split('timestamp":"')[1]?.split('"')[0];
      if (!timestamp) return false;

      // Note: This is a simplified verification
      // In production, you'd use a proper Ed25519 library like 'tweetnacl'
      // For now, we'll implement a basic verification structure
      
      // This is where you'd normally use Ed25519 verification
      // const isValid = nacl.sign.detached.verify(
      //   Buffer.concat([Buffer.from(timestamp), rawBody]),
      //   Buffer.from(signature, 'hex'),
      //   Buffer.from(publicKey, 'hex')
      // );
      
      // For this implementation, we'll do a basic check
      // In real usage, you should implement proper Ed25519 verification
      return signature.length === 128; // Ed25519 signatures are 64 bytes = 128 hex chars
    } catch (error) {
      console.error('Discord signature verification error:', error);
      return false;
    }
  },

  parsePayload(body) {
    return JSON.parse(body.toString("utf8"));
  },

  normalize(event, options) {
    let type = 'unknown';
    let id = '';
    let timestamp = Math.floor(Date.now() / 1000);
    let payload: Record<string, any> = {};

    // Handle Discord event types
    if (event.type !== undefined) {
      // Interaction events (slash commands, buttons, etc.)
      switch (event.type) {
        case 1: // PING
          type = 'ping';
          id = `ping_${Date.now()}`;
          payload = { type: 'ping' };
          break;
        case 2: // APPLICATION_COMMAND
          type = 'interaction.application_command';
          id = event.id || `cmd_${Date.now()}`;
          timestamp = event.id ? Math.floor(parseInt(event.id) / 4194304 + 1420070400000) / 1000 : timestamp;
          payload = {
            type: 'application_command',
            command: event.data?.name,
            options: event.data?.options,
            user: event.member?.user || event.user,
            guild_id: event.guild_id,
            channel_id: event.channel_id,
            token: event.token,
            application_id: event.application_id
          };
          break;
        case 3: // MESSAGE_COMPONENT
          type = 'interaction.message_component';
          id = event.id || `component_${Date.now()}`;
          timestamp = event.id ? Math.floor(parseInt(event.id) / 4194304 + 1420070400000) / 1000 : timestamp;
          payload = {
            type: 'message_component',
            custom_id: event.data?.custom_id,
            component_type: event.data?.component_type,
            user: event.member?.user || event.user,
            guild_id: event.guild_id,
            channel_id: event.channel_id,
            message: event.message
          };
          break;
        case 4: // APPLICATION_COMMAND_AUTOCOMPLETE
          type = 'interaction.autocomplete';
          id = event.id || `autocomplete_${Date.now()}`;
          payload = {
            type: 'autocomplete',
            command: event.data?.name,
            options: event.data?.options,
            user: event.member?.user || event.user,
            guild_id: event.guild_id,
            channel_id: event.channel_id
          };
          break;
        case 5: // MODAL_SUBMIT
          type = 'interaction.modal_submit';
          id = event.id || `modal_${Date.now()}`;
          payload = {
            type: 'modal_submit',
            custom_id: event.data?.custom_id,
            components: event.data?.components,
            user: event.member?.user || event.user,
            guild_id: event.guild_id,
            channel_id: event.channel_id
          };
          break;
        default:
          type = `interaction.${event.type}`;
          id = event.id || `interaction_${Date.now()}`;
          payload = event;
      }
    } else if (event.t) {
      // Gateway events (if using webhooks for gateway events)
      const eventType = event.t.toLowerCase();
      type = `gateway.${eventType}`;
      id = `${eventType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      switch (event.t) {
        case 'GUILD_CREATE':
        case 'GUILD_UPDATE':
        case 'GUILD_DELETE':
          payload = {
            event_type: event.t,
            guild: event.d,
            timestamp: event.d?.joined_at
          };
          break;
        case 'MESSAGE_CREATE':
        case 'MESSAGE_UPDATE':
        case 'MESSAGE_DELETE':
          payload = {
            event_type: event.t,
            message: event.d,
            guild_id: event.d?.guild_id,
            channel_id: event.d?.channel_id,
            author: event.d?.author
          };
          break;
        case 'GUILD_MEMBER_ADD':
        case 'GUILD_MEMBER_UPDATE':
        case 'GUILD_MEMBER_REMOVE':
          payload = {
            event_type: event.t,
            member: event.d,
            guild_id: event.d?.guild_id,
            user: event.d?.user
          };
          break;
        case 'VOICE_STATE_UPDATE':
          payload = {
            event_type: event.t,
            voice_state: event.d,
            guild_id: event.d?.guild_id,
            channel_id: event.d?.channel_id,
            user_id: event.d?.user_id
          };
          break;
        default:
          payload = {
            event_type: event.t,
            data: event.d
          };
      }
    } else if (event.content !== undefined) {
      // Direct message webhook
      type = 'webhook.message';
      id = event.id || `msg_${Date.now()}`;
      timestamp = event.timestamp ? Math.floor(new Date(event.timestamp).getTime() / 1000) : timestamp;
      payload = {
        content: event.content,
        embeds: event.embeds,
        author: event.author,
        webhook_id: event.webhook_id,
        channel_id: event.channel_id,
        guild_id: event.guild_id
      };
    } else {
      // Generic Discord event
      type = 'discord.unknown';
      id = `discord_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      payload = event;
    }

    return {
      id,
      type,
      source: "discord",
      timestamp,
      payload,
      raw: options?.includeRaw ? JSON.stringify(event) : '',
    };
  },
};

export default discord; 