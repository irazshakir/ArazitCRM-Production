import { supabase } from '../config/database.js';

const InvoiceModel = {
  create: async (invoiceData) => {
    try {
      let status = 'Pending';
      if (invoiceData.amount_received > 0) {
        status = invoiceData.remaining_amount === 0 ? 'Paid' : 'Partially Paid';
      }

      const invoicePayload = {
        invoice_number: invoiceData.invoiceNumber,
        created_date: invoiceData.created_date,
        due_date: invoiceData.due_date,
        bill_to: invoiceData.bill_to,
        notes: invoiceData.notes || null,
        total_amount: invoiceData.total_amount,
        amount_received: invoiceData.amount_received,
        remaining_amount: invoiceData.remaining_amount,
        status: status
      };

      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert([invoicePayload])
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      if (invoiceData.items && invoiceData.items.length > 0) {
        const { error: itemsError } = await supabase
          .from('invoice_items')
          .insert(
            invoiceData.items.map(item => ({
              invoice_id: invoice.id,
              service_name: item.service_name,
              description: item.description,
              amount: item.amount
            }))
          );

        if (itemsError) throw itemsError;
      }

      if (invoiceData.amount_received > 0) {
        const { error: paymentError } = await supabase
          .from('payment_history')
          .insert([{
            invoice_id: invoice.id,
            amount: invoiceData.amount_received,
            payment_type: 'Online',
            payment_date: invoiceData.created_date,
            remaining_amount: invoiceData.remaining_amount,
            payment_notes: invoiceData.notes
          }]);

        if (paymentError) throw paymentError;
      }

      return invoice;
    } catch (error) {
      throw error;
    }
  },

  findAll: async ({ search, timeRange, startDate, endDate, status } = {}) => {
    try {
      let query = supabase
        .from('invoices')
        .select(`
          *,
          invoice_items (*)
        `);

      // Add search filter if provided
      if (search && search.trim()) {
        query = query.or(`
          bill_to.ilike.%${search.trim()}%,
          invoice_number.ilike.%${search.trim()}%
        `);
      }

      // Add status filter if provided
      if (status) {
        query = query.eq('status', status);
      }

      // Handle date filtering
      if (timeRange) {
        const now = new Date();
        const formatDate = (date) => date.toISOString().split('T')[0];

        if (timeRange === 'currMonth') {
          const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          
          query = query
            .gte('created_date', formatDate(firstDayOfMonth))
            .lte('created_date', formatDate(lastDayOfMonth));
        } 
        else if (timeRange === 'prevMonth') {
          const firstDayOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          const lastDayOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
          
          query = query
            .gte('created_date', formatDate(firstDayOfPrevMonth))
            .lte('created_date', formatDate(lastDayOfPrevMonth));
        }
      }
      // Handle custom date range
      else if (startDate && endDate) {
        query = query
          .gte('created_date', startDate)
          .lte('created_date', endDate);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      throw error;
    }
  },

  findOne: async (id) => {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          invoice_items (*),
          payment_history (*)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      throw error;
    }
  },

  update: async (id, invoiceData) => {
    try {
      // Calculate total amount from items if provided
      let totalAmount = invoiceData.total_amount;
      
      const updatePayload = {
        created_date: invoiceData.created_date,
        due_date: invoiceData.due_date,
        bill_to: invoiceData.bill_to,
        notes: invoiceData.notes,
        total_amount: totalAmount,
        updated_at: new Date()
      };

      const { data: invoice, error } = await supabase
        .from('invoices')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return invoice;
    } catch (error) {
      throw error;
    }
  },

  addPayment: async (invoiceId, paymentData) => {
    try {
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .select('total_amount, amount_received')
        .eq('id', invoiceId)
        .single();

      if (invoiceError) throw new Error('Failed to fetch invoice details');
      if (!invoice) throw new Error('Invoice not found');

      const currentAmountReceived = Number(invoice.amount_received) || 0;
      const paymentAmount = Number(paymentData.amount) || 0;
      const totalAmount = Number(invoice.total_amount) || 0;

      const newAmountReceived = currentAmountReceived + paymentAmount;
      const remainingAmount = totalAmount - newAmountReceived;

      if (newAmountReceived > totalAmount) {
        throw new Error('Payment amount exceeds invoice total');
      }

      let status = 'Pending';
      if (remainingAmount === 0) {
        status = 'Paid';
      } else if (newAmountReceived > 0) {
        status = 'Partially Paid';
      }

      const { data: payment, error: paymentError } = await supabase
        .from('payment_history')
        .insert([{
          invoice_id: invoiceId,
          amount: paymentAmount,
          payment_type: paymentData.paymentType,
          payment_date: paymentData.paymentDate,
          remaining_amount: remainingAmount,
          payment_notes: paymentData.notes || null
        }])
        .select();

      if (paymentError) throw new Error('Failed to create payment record');

      const { error: updateError } = await supabase
        .from('invoices')
        .update({
          amount_received: newAmountReceived,
          remaining_amount: remainingAmount,
          status: status
        })
        .eq('id', invoiceId);

      if (updateError) throw new Error('Failed to update invoice');

      const { data: updatedInvoice, error: fetchError } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', invoiceId)
        .single();

      if (fetchError) throw new Error('Failed to fetch updated invoice');

      return {
        payment: payment[0],
        invoice: updatedInvoice
      };
    } catch (error) {
      throw error;
    }
  },

  getInvoiceItems: async (invoiceId) => {
    try {
      const { data, error } = await supabase
        .from('invoice_items')
        .select('*')
        .eq('invoice_id', invoiceId);

      if (error) throw error;
      return data;
    } catch (error) {
      throw error;
    }
  },

  getPaymentHistory: async (invoiceId) => {
    try {
      const { data, error } = await supabase
        .from('payment_history')
        .select('*')
        .eq('invoice_id', invoiceId)
        .order('payment_date', { ascending: false });

      if (error) throw error;
      return data;
    } catch (error) {
      throw error;
    }
  },

  deleteInvoiceItems: async (invoiceId) => {
    try {
      const { error } = await supabase
        .from('invoice_items')
        .delete()
        .eq('invoice_id', invoiceId);

      if (error) throw error;
    } catch (error) {
      throw error;
    }
  },

  addInvoiceItems: async (invoiceId, items) => {
    try {
      const itemsToInsert = items.map(item => ({
        invoice_id: invoiceId,
        service_name: item.service_name,
        description: item.description,
        amount: item.amount
      }));

      const { error } = await supabase
        .from('invoice_items')
        .insert(itemsToInsert);

      if (error) throw error;
    } catch (error) {
      throw error;
    }
  },

  exportData: async ({ search, timeRange, startDate, endDate, status }) => {
    try {
      const invoices = await InvoiceModel.findAll({ 
        search, 
        timeRange, 
        startDate, 
        endDate, 
        status 
      });
      
      // Convert data to CSV format
      const headers = [
        'Invoice Number',
        'Created Date',
        'Due Date',
        'Bill To',
        'Total Amount',
        'Amount Received',
        'Remaining Amount',
        'Status',
        'Notes',
        'Created At',
        'Updated At'
      ].join(',');

      const rows = invoices.map(invoice => [
        invoice.invoice_number,
        new Date(invoice.created_date).toISOString().split('T')[0],
        new Date(invoice.due_date).toISOString().split('T')[0],
        (invoice.bill_to || '').replace(/,/g, ';'),
        invoice.total_amount,
        invoice.amount_received,
        invoice.remaining_amount,
        invoice.status,
        (invoice.notes || '').replace(/,/g, ';'),
        new Date(invoice.created_at).toISOString(),
        new Date(invoice.updated_at).toISOString()
      ].join(','));

      return [headers, ...rows].join('\n');
    } catch (error) {
      throw error;
    }
  }
};

export default InvoiceModel; 