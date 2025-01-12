import supabase from '../config/database.js';

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
      
      if (error) {
        console.error('Supabase query error:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error in findAll:', error);
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
      const { data, error } = await supabase
        .from('invoices')
        .update(invoiceData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
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
  }
};

export default InvoiceModel; 