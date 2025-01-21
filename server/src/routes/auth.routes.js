import express from 'express';
import { supabase } from '../config/supabase.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { SessionModel } from '../../models/index.js';

const router = express.Router();

// Create new user (can be used by admin/manager through forms)
router.post('/create-user', async (req, res) => {
  try {
    const { 
      email, 
      password, 
      name, 
      role_id,
      user_is_active = true,
      email_verified = false
    } = req.body;

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Validate required fields
    if (!email || !password || !name || !role_id) {
      throw new Error('Missing required fields');
    }

    // 1. Create auth user in Supabase
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: email_verified, // Admin can set if email is pre-verified
      user_metadata: {
        name,
        role_id
      }
    });

    if (authError) throw authError;

    // 2. Create user record in users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .insert([
        {
          name,
          email,
          password: hashedPassword,
          role_id,
          user_is_active,
          email_verified,
          email_verified_at: email_verified ? new Date().toISOString() : null,
          activated_at: user_is_active ? new Date().toISOString() : null
        },
      ])
      .select('*, roles(*)')
      .single();

    if (userError) throw userError;

    res.status(200).json({
      status: 'success',
      message: 'User created successfully',
      data: userData,
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: error.message,
    });
  }
});

// Regular signup (for self-registration if needed)
router.post('/signup', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // For self-signup, assign default role (e.g., 'user' role)
    const defaultRoleId = 3; // Assuming 3 is the 'user' role ID

    // 1. Create auth user in Supabase
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          role_id: defaultRoleId
        }
      }
    });

    if (authError) throw authError;

    // 2. Create user record in users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .insert([
        {
          name,
          email,
          role_id: defaultRoleId,
          user_is_active: true,
          email_verified: false
        },
      ])
      .select('*, roles(*)')
      .single();

    if (userError) throw userError;

    res.status(200).json({
      status: 'success',
      message: 'User registered successfully. Please verify your email.',
      data: userData,
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: error.message,
    });
  }
});

// Sign in
router.post('/signin', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Get user data
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*, roles(*)')
      .eq('email', email)
      .single();

    if (userError) throw userError;
    
    if (!userData) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid credentials'
      });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, userData.password);
    if (!validPassword) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid credentials'
      });
    }

    // Generate proper JWT token with user data
    const token = jwt.sign(
      { 
        userId: userData.id,
        email: userData.email,
        role: userData.roles?.role_name 
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Create session record
    const { error: sessionError } = await supabase
      .from('sessions')
      .insert([
        {
          user_id: userData.id,
          token: token,
          is_active: true,
          last_activity_at: new Date().toISOString()
        }
      ]);

    if (sessionError) throw sessionError;

    res.status(200).json({
      status: 'success',
      message: 'Signed in successfully',
      data: {
        user: {
          id: userData.id,
          name: userData.name,
          email: userData.email,
          role: userData.roles?.role_name
        },
        token
      }
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: error.message
    });
  }
});

// Update user
router.put('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      name, 
      email, 
      password, // Optional password update
      role_id,
      user_is_active,
      email_verified 
    } = req.body;

    // 1. Update auth user if email or password changed
    if (email || password) {
      const updateData = {};
      if (email) updateData.email = email;
      if (password) updateData.password = password;

      const { error: authError } = await supabase.auth.admin.updateUserById(
        id,
        updateData
      );

      if (authError) throw authError;
    }

    // 2. Update user record in users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .update({
        name,
        email,
        role_id,
        user_is_active,
        email_verified,
        email_verified_at: email_verified ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select('*, roles(*)')
      .single();

    if (userError) throw userError;

    res.status(200).json({
      status: 'success',
      message: 'User updated successfully',
      data: userData,
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: error.message,
    });
  }
});

// Add this route handler
router.post('/logout', async (req, res) => {
  try {
    const { sessionId } = req.body;
    
    // Update session status in database
    const { error } = await supabase
      .from('sessions')
      .update({ 
        is_active: false,
        last_activity_at: new Date().toISOString()
      })
      .eq('id', sessionId);

    if (error) throw error;

    res.status(200).json({
      status: 'success',
      message: 'Logged out successfully'
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: error.message
    });
  }
});

// Add this new route to get current user from session
router.get('/current-user', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ 
        status: 'error',
        message: 'No token provided' 
      });
    }

    try {
      const userData = await SessionModel.getCurrentUser(token);
      res.status(200).json({
        status: 'success',
        data: userData
      });
    } catch (error) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid or expired session'
      });
    }
  } catch (error) {
    res.status(500).json({ 
      status: 'error',
      message: 'Error fetching current user',
      error: error.message 
    });
  }
});

export default router; 