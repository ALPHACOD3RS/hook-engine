import crypto from "crypto";
import type { WebhookAdapter } from "../types/adapter";

/**
 * Shopify webhook adapter
 * Supports: orders, products, customers, inventory, app events, and more
 * Documentation: https://shopify.dev/docs/apps/webhooks
 */
const shopify: WebhookAdapter = {
  getSignature(req) {
    // Shopify sends signature in X-Shopify-Hmac-Sha256 header
    return req.headers["x-shopify-hmac-sha256"] as string | undefined;
  },

  verifySignature(rawBody, signature, secret) {
    if (!signature) return false;

    try {
      const expected = crypto
        .createHmac("sha256", secret)
        .update(rawBody)
        .digest("base64");

      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    } catch (error) {
      console.error('Shopify signature verification error:', error);
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

    // Determine event type from the webhook topic (usually passed in headers or inferred from structure)
    if (event.id) {
      id = event.id.toString();
    }

    // Handle different Shopify event types based on structure
    if (event.line_items && event.total_price !== undefined) {
      // Order events
      type = 'orders.created';
      if (event.cancelled_at) type = 'orders.cancelled';
      if (event.fulfilled_at) type = 'orders.fulfilled';
      if (event.financial_status) {
        switch (event.financial_status) {
          case 'paid': type = 'orders.paid'; break;
          case 'refunded': type = 'orders.refunded'; break;
          case 'partially_refunded': type = 'orders.partially_refunded'; break;
        }
      }
      
      timestamp = event.created_at ? Math.floor(new Date(event.created_at).getTime() / 1000) : timestamp;
      payload = {
        order_id: event.id,
        order_number: event.order_number,
        name: event.name,
        email: event.email,
        total_price: event.total_price,
        subtotal_price: event.subtotal_price,
        total_tax: event.total_tax,
        currency: event.currency,
        financial_status: event.financial_status,
        fulfillment_status: event.fulfillment_status,
        line_items: event.line_items,
        customer: event.customer,
        billing_address: event.billing_address,
        shipping_address: event.shipping_address,
        payment_gateway_names: event.payment_gateway_names,
        tags: event.tags,
        note: event.note,
        created_at: event.created_at,
        updated_at: event.updated_at
      };
    } else if (event.title && event.handle && event.vendor !== undefined) {
      // Product events
      type = 'products.created';
      if (event.updated_at && new Date(event.updated_at) > new Date(event.created_at)) {
        type = 'products.updated';
      }
      
      timestamp = event.created_at ? Math.floor(new Date(event.created_at).getTime() / 1000) : timestamp;
      payload = {
        product_id: event.id,
        title: event.title,
        handle: event.handle,
        vendor: event.vendor,
        product_type: event.product_type,
        status: event.status,
        tags: event.tags,
        variants: event.variants,
        images: event.images,
        options: event.options,
        created_at: event.created_at,
        updated_at: event.updated_at,
        published_at: event.published_at
      };
    } else if (event.first_name !== undefined && event.last_name !== undefined && event.email) {
      // Customer events
      type = 'customers.created';
      if (event.updated_at && new Date(event.updated_at) > new Date(event.created_at)) {
        type = 'customers.updated';
      }
      
      timestamp = event.created_at ? Math.floor(new Date(event.created_at).getTime() / 1000) : timestamp;
      payload = {
        customer_id: event.id,
        email: event.email,
        first_name: event.first_name,
        last_name: event.last_name,
        phone: event.phone,
        addresses: event.addresses,
        orders_count: event.orders_count,
        total_spent: event.total_spent,
        tags: event.tags,
        accepts_marketing: event.accepts_marketing,
        created_at: event.created_at,
        updated_at: event.updated_at,
        last_order_id: event.last_order_id,
        last_order_name: event.last_order_name
      };
    } else if (event.order_id && event.line_items) {
      // Fulfillment events
      type = 'fulfillments.created';
      if (event.status === 'success') type = 'fulfillments.fulfilled';
      if (event.status === 'cancelled') type = 'fulfillments.cancelled';
      
      timestamp = event.created_at ? Math.floor(new Date(event.created_at).getTime() / 1000) : timestamp;
      payload = {
        fulfillment_id: event.id,
        order_id: event.order_id,
        status: event.status,
        tracking_company: event.tracking_company,
        tracking_number: event.tracking_number,
        tracking_url: event.tracking_url,
        line_items: event.line_items,
        created_at: event.created_at,
        updated_at: event.updated_at
      };
    } else if (event.inventory_item_id) {
      // Inventory events
      type = 'inventory_levels.updated';
      payload = {
        inventory_item_id: event.inventory_item_id,
        location_id: event.location_id,
        available: event.available,
        updated_at: event.updated_at
      };
    } else if (event.order_id && event.amount) {
      // Refund events
      type = 'refunds.created';
      timestamp = event.created_at ? Math.floor(new Date(event.created_at).getTime() / 1000) : timestamp;
      payload = {
        refund_id: event.id,
        order_id: event.order_id,
        amount: event.amount,
        currency: event.currency,
        reason: event.reason,
        refund_line_items: event.refund_line_items,
        transactions: event.transactions,
        created_at: event.created_at
      };
    } else if (event.collection_id || event.product_id) {
      // Collection events
      if (event.collection_id) {
        type = 'collections.updated';
        payload = {
          collection_id: event.collection_id,
          product_id: event.product_id,
          position: event.position,
          featured: event.featured,
          created_at: event.created_at,
          updated_at: event.updated_at
        };
      }
    } else if (event.checkout_id || event.abandoned_checkout_url) {
      // Checkout events
      type = 'checkouts.created';
      if (event.completed_at) type = 'checkouts.completed';
      
      timestamp = event.created_at ? Math.floor(new Date(event.created_at).getTime() / 1000) : timestamp;
      payload = {
        checkout_id: event.id,
        token: event.token,
        cart_token: event.cart_token,
        email: event.email,
        total_price: event.total_price,
        subtotal_price: event.subtotal_price,
        line_items: event.line_items,
        customer: event.customer,
        abandoned_checkout_url: event.abandoned_checkout_url,
        created_at: event.created_at,
        updated_at: event.updated_at,
        completed_at: event.completed_at
      };
    } else if (event.api_client_id) {
      // App events
      type = 'app.uninstalled';
      payload = {
        api_client_id: event.api_client_id,
        shop_id: event.shop_id,
        shop_domain: event.shop_domain
      };
    } else if (event.domain) {
      // Shop events
      type = 'shop.updated';
      payload = {
        shop_id: event.id,
        name: event.name,
        domain: event.domain,
        email: event.email,
        currency: event.currency,
        country_code: event.country_code,
        province_code: event.province_code,
        plan_name: event.plan_name,
        created_at: event.created_at,
        updated_at: event.updated_at
      };
    } else {
      // Generic Shopify event
      type = 'shopify.unknown';
      id = event.id?.toString() || `shopify_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      payload = event;
    }

    // Use fallback ID if not set
    if (!id) {
      id = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    return {
      id,
      type,
      source: "shopify",
      timestamp,
      payload,
      raw: options?.includeRaw ? JSON.stringify(event) : '',
    };
  },
};

export default shopify;