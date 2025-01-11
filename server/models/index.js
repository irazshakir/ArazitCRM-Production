import supabase from '../config/database.js';
import jwt from 'jsonwebtoken';
import CustomUmrahHotelModel from './CustomUmrahHotelModel.js';
import CustomUmrahServiceModel from './CustomUmrahServiceModel.js';
import CustomUmrahPriceModel from './CustomUmrahPriceModel.js';



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
        .select('id, name');
      
      if (where?.is_active) {
        query = query.eq('user_is_active', true);
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
          users!assigned_user(name)
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
      return data;
    } catch (error) {
      throw error;
    }
  },

  create: async (values) => {
    try {
      const { data, error } = await supabase
        .from('leads')
        .insert([values])
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
        .select()
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
      const { data: updatedLead, error } = await supabase
        .from('leads')
        .update({
          assigned_user: data.assigned_user,
          updated_at: new Date().toISOString()
        })
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
          users:assigned_user (name)
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
          users (name)
        `)
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    } catch (error) {
      throw error;
    }
  },

  createNote: async (noteData) => {
    try {
      const { data, error } = await supabase
        .from('lead_notes')
        .insert([noteData])
        .select(`
          *,
          users (name)
        `);
      if (error) throw error;
      return data[0];
    } catch (error) {
      throw error;
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

export {
  CustomUmrahHotelModel,
  CustomUmrahServiceModel,
  CustomUmrahPriceModel
};

