import express from 'express';
import { InvoiceModel } from '../models/index.js';

const router = express.Router();

// Create new invoice
router.post('/invoices', async (req, res) => {
  try {
    const invoice = await InvoiceModel.create(req.body);
    res.status(201).json({
      message: 'Invoice created successfully',
      data: invoice
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Error creating invoice', 
      error: error.message
    });
  }
});

// Get all invoices
router.get('/invoices', async (req, res) => {
  try {
    const { search, timeRange, startDate, endDate, status } = req.query;
    
    const invoices = await InvoiceModel.findAll({ 
      search: search ? search.trim() : null,
      timeRange,
      startDate,
      endDate,
      status 
    });
    
    res.json(invoices);
  } catch (error) {
    res.status(500).json({ 
      message: 'Error fetching invoices', 
      error: error.message 
    });
  }
});

// Get single invoice
router.get('/invoices/:id', async (req, res) => {
  try {
    const invoice = await InvoiceModel.findOne(req.params.id);
    if (!invoice) {
      return res.status(404).json({ message: 'Invoice not found' });
    }
    res.json(invoice);
  } catch (error) {
    res.status(500).json({ 
      message: 'Error fetching invoice', 
      error: error.message 
    });
  }
});

// Add payment to invoice
router.post('/invoices/:id/payments', async (req, res) => {
  try {
    if (!req.params.id) {
      return res.status(400).json({
        message: 'Invoice ID is required'
      });
    }

    if (!req.body.amount || !req.body.paymentType || !req.body.paymentDate) {
      return res.status(400).json({
        message: 'Amount, payment type, and payment date are required'
      });
    }

    const payment = await InvoiceModel.addPayment(req.params.id, req.body);
    
    res.status(201).json({
      message: 'Payment added successfully',
      data: payment
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Error adding payment', 
      error: error.message
    });
  }
});

// Get invoice items
router.get('/invoices/:id/items', async (req, res) => {
  try {
    const items = await InvoiceModel.getInvoiceItems(req.params.id);
    res.json(items);
  } catch (error) {
    res.status(500).json({ 
      message: 'Error fetching invoice items', 
      error: error.message 
    });
  }
});

// Get invoice payment history
router.get('/invoices/:id/payments', async (req, res) => {
  try {
    const payments = await InvoiceModel.getPaymentHistory(req.params.id);
    res.json(payments);
  } catch (error) {
    res.status(500).json({ 
      message: 'Error fetching payment history', 
      error: error.message 
    });
  }
});

// Update invoice
router.put('/invoices/:id', async (req, res) => {
  try {
    const invoiceId = req.params.id;
    const updateData = req.body;
    
    // Validate required fields
    if (!updateData.created_date || !updateData.due_date || !updateData.billTo) {
      return res.status(400).json({
        message: 'Required fields are missing'
      });
    }

    const updatedInvoice = await InvoiceModel.update(invoiceId, {
      created_date: updateData.created_date,
      due_date: updateData.due_date,
      bill_to: updateData.billTo,
      notes: updateData.notes,
      total_amount: updateData.total_amount
    });

    // Update invoice items if provided
    if (updateData.items && updateData.items.length > 0) {
      // First delete existing items
      await InvoiceModel.deleteInvoiceItems(invoiceId);
      
      // Then insert new items
      await InvoiceModel.addInvoiceItems(invoiceId, updateData.items);
    }

    res.json({
      message: 'Invoice updated successfully',
      data: updatedInvoice
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Error updating invoice', 
      error: error.message 
    });
  }
});

export default router; 