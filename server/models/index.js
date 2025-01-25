import { supabase } from '../config/database.js';
import CustomUmrahHotelModel from './CustomUmrahHotelModel.js';
import CustomUmrahServiceModel from './CustomUmrahServiceModel.js';
import CustomUmrahPriceModel from './CustomUmrahPriceModel.js';
import InvoiceModel from './InvoiceModel.js';
import DashboardModel from './DashboardModel.js';
import ReportsModel from './ReportsModel.js';
import UserDashboardModel from './UserDashboardModel.js';
import { TemplateMessageModel } from './TemplateMessageModel.js';
import AccountModel from './AccountModel.js';

// Direct model definitions
export const ProductModel = {
  findAll: async ({ where } = {}) => {
    try {
      let query = supabase
        .from('products')
        .select('id, product_name');
      
      if (where?.is_active) {
        query = query.eq('product_is_active', true);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    } catch (error) {
      throw error;
    }
  }
};

export const StageModel = {
  findAll: async ({ where } = {}) => {
    try {
      let query = supabase
        .from('stages')
        .select('id, stage_name');
      
      if (where?.is_active) {
        query = query.eq('stage_is_active', true);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    } catch (error) {
      throw error;
    }
  }
};

export const LeadSourceModel = {
  findAll: async ({ where } = {}) => {
    try {
      let query = supabase
        .from('lead_sources')
        .select('id, lead_source_name');
      
      if (where?.is_active) {
        query = query.eq('lead_source_is_active', true);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    } catch (error) {
      throw error;
    }
  }
};

export const UserModel = {
  findAll: async ({ where } = {}) => {
    try {
      let query = supabase
        .from('users')
        .select(`
          id, 
          name,
          email,
          user_is_active,
          roles (
            role_name
          )
        `);
      
      // If is_active is specified in where clause, filter accordingly
      if (where?.is_active !== undefined) {
        query = query.eq('user_is_active', where.is_active);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    } catch (error) {
      throw error;
    }
  }
};

export const LeadModel = {
  findAll: async ({ search, include } = {}) => {
    try {
      let query = supabase
        .from('leads')
        .select(`
          *,
          products!lead_product(product_name),
          stages!lead_stage(stage_name),
          lead_sources!lead_source_id(lead_source_name),
          users!assigned_user(name),
          company_branches!leads_branch_id_fkey(branch_name)
        `);
      
      if (search && search.trim()) {
        query = query.or([
          `name.ilike.%${search}%`,
          `phone.ilike.%${search}%`,
          `email.ilike.%${search}%`
        ].join(','));
      }
      
      const { data, error } = await query;
      if (error) throw error;

      // Additional processing to sort leads
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      return data.sort((a, b) => {
        // First, sort by active status
        if (a.lead_active_status !== b.lead_active_status) {
          return a.lead_active_status ? -1 : 1;
        }

        // For leads with same active status, sort by followup date
        const dateA = new Date(a.fu_date);
        const dateB = new Date(b.fu_date);

        // Simple ascending date sort for all dates
        return dateA - dateB;

        // Then sort by time if dates are equal
        if (dateA.getTime() === dateB.getTime()) {
          const timeA = (a.fu_hour * 60) + a.fu_minutes + (a.fu_period === 'PM' ? 720 : 0);
          const timeB = (b.fu_hour * 60) + b.fu_minutes + (b.fu_period === 'PM' ? 720 : 0);
          return timeA - timeB;
        }
      });
    } catch (error) {
      throw error;
    }
  },

  create: async (values) => {
    try {
      const now = new Date().toISOString();
      const dataToInsert = {
        ...values,
        // Add closed_at if lead is inactive
        ...(values.lead_active_status === false && { closed_at: now }),
        // Add won_at if lead stage is 4 (Won)
        ...(values.lead_stage === 4 && { won_at: now })
      };

      const { data, error } = await supabase
        .from('leads')
        .insert([dataToInsert])
        .select();

      if (error) throw error;
      return data[0];
    } catch (error) {
      throw error;
    }
  },

  findByPk: async (id) => {
    try {
      const { data, error } = await supabase
        .from('leads')
        .select(`
          *,
          company_branches!leads_branch_id_fkey (
            id,
            branch_name
          )
        `)
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    } catch (error) {
      throw error;
    }
  },

  update: async (id, data) => {
    try {
      const now = new Date().toISOString();
      
      // Create a dynamic update object only with provided fields
      const updatedData = {
        updated_at: now
      };

      // Only add fields that are present in the update request
      if (data.name !== undefined) updatedData.name = data.name;
      if (data.phone !== undefined) updatedData.phone = data.phone;
      if (data.email !== undefined) updatedData.email = data.email;
      if (data.lead_product !== undefined) updatedData.lead_product = data.lead_product;
      if (data.lead_stage !== undefined) updatedData.lead_stage = data.lead_stage;
      if (data.lead_source_id !== undefined) updatedData.lead_source_id = data.lead_source_id;
      if (data.branch_id !== undefined) updatedData.branch_id = data.branch_id;
      if (data.fu_date !== undefined) updatedData.fu_date = data.fu_date;
      if (data.fu_hour !== undefined) updatedData.fu_hour = data.fu_hour;
      if (data.fu_minutes !== undefined) updatedData.fu_minutes = data.fu_minutes;
      if (data.fu_period !== undefined) updatedData.fu_period = data.fu_period;
      if (data.lead_active_status !== undefined) updatedData.lead_active_status = data.lead_active_status;
      if (data.assigned_user !== undefined) updatedData.assigned_user = data.assigned_user;

      // Handle special cases
      if (data.lead_active_status === false) {
        updatedData.closed_at = now;
      } else if (data.lead_active_status === true) {
        updatedData.closed_at = null;
      }

      if (data.lead_stage === 4) {
        updatedData.won_at = now;
      }

      const { data: updatedLead, error } = await supabase
        .from('leads')
        .update(updatedData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return updatedLead;
    } catch (error) {
      throw error;
    }
  },

  destroy: async (id) => {
    try {
      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return true;
    } catch (error) {
      throw error;
    }
  },

  findOne: async (id) => {
    try {
      const { data, error } = await supabase
        .from('leads')
        .select(`
          id,
          name,
          phone,
          email,
          lead_product,
          lead_stage,
          lead_source_id,
          branch_id,
          assigned_user,
          fu_date,
          fu_hour,
          fu_minutes,
          fu_period,
          lead_active_status,
          initial_remarks,
          products:lead_product (product_name),
          stages:lead_stage (stage_name),
          lead_sources:lead_source_id (lead_source_name),
          users:assigned_user (name),
          company_branches:branch_id (branch_name)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      throw error;
    }
  },

  findNotes: async (leadId) => {
    try {
      const { data, error } = await supabase
        .from('lead_notes')
        .select(`
          *,
          users (
            id,
            name
          )
        `)
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Return in the expected format
      return {
        success: true,
        data: data.map(note => ({
          ...note,
          created_at: note.created_at,
          users: note.users // This will contain the user details
        }))
      };
    } catch (error) {
      console.error('LeadModel.findNotes error:', error);
      throw {
        success: false,
        error: error.message
      };
    }
  },

  createNote: async (noteData) => {
    try {
      const { data, error } = await supabase
        .from('lead_notes')
        .insert([noteData])
        .select(`
          *,
          users (
            id,
            name
          )
        `);

      if (error) throw error;

      // Return in the expected format
      return {
        success: true,
        data: data[0]
      };
    } catch (error) {
      console.error('LeadModel.createNote error:', error);
      throw {
        success: false,
        error: error.message
      };
    }
  }
};

export const SessionModel = {
  getCurrentUser: async (token) => {
    try {
      // Get active session with user data
      const { data: sessionData, error: sessionError } = await supabase
        .from('sessions')
        .select(`
          *,
          users (
            id,
            name,
            email,
            roles (
              role_name
            )
          )
        `)
        .eq('token', token)
        .eq('is_active', true)
        .single();

      if (sessionError) throw sessionError;
      
      if (!sessionData) {
        throw new Error('Session not found or expired');
      }

      // Check if session is expired
      if (new Date(sessionData.expires_at) < new Date()) {
        throw new Error('Session expired');
      }

      return {
        user_id: sessionData.users.id,
        name: sessionData.users.name,
        email: sessionData.users.email,
        role: sessionData.users.roles?.role_name
      };
    } catch (error) {
      console.error('SessionModel error:', error);
      throw error;
    }
  }
};

export const BranchModel = {
  findAll: async () => {
    try {
      const { data, error } = await supabase
        .from('company_branches')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    } catch (error) {
      throw error;
    }
  },

  create: async (values) => {
    try {
      const { data, error } = await supabase
        .from('company_branches')
        .insert([values])
        .select();
      
      if (error) throw error;
      return data[0];
    } catch (error) {
      throw error;
    }
  },

  update: async (id, values) => {
    try {
      const { data, error } = await supabase
        .from('company_branches')
        .update(values)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      throw error;
    }
  },

  destroy: async (id) => {
    try {
      const { error } = await supabase
        .from('company_branches')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return true;
    } catch (error) {
      throw error;
    }
  }
};

// Export all models
export {
  CustomUmrahHotelModel,
  CustomUmrahServiceModel,
  CustomUmrahPriceModel,
  InvoiceModel,
  DashboardModel,
  ReportsModel,
  UserDashboardModel,
  TemplateMessageModel,
  AccountModel
};

