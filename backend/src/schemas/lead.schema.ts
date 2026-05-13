import { z } from 'zod';

export const CreateLeadSchema = z.object({
  name:        z.string().min(1, 'Name is required').max(255),
  email:       z.string().email('Invalid email').optional().or(z.literal('')),
  phone:       z.string().max(30).optional(),
  source:      z.string().max(50).optional(),
  pipeline_id: z.string().uuid('Invalid pipeline_id').optional(),
  stage_id:    z.string().uuid('Invalid stage_id').optional(),
  assigned_to: z.string().uuid('Invalid assigned_to').optional().nullable(),
  notes:       z.string().max(5000).optional(),
  tags:        z.array(z.string()).optional(),
});

export const UpdateLeadSchema = z.object({
  name:        z.string().min(1).max(255).optional(),
  email:       z.string().email().optional().or(z.literal('')),
  phone:       z.string().max(30).optional(),
  source:      z.string().max(50).optional(),
  pipeline_id: z.string().uuid().optional().nullable(),
  stage_id:    z.string().uuid().optional().nullable(),
  assigned_to: z.string().uuid().optional().nullable(),
  notes:       z.string().max(5000).optional(),
  tags:        z.array(z.string()).optional(),
  status:      z.string().max(50).optional(),
}).refine((d) => Object.keys(d).length > 0, { message: 'No fields to update' });

export type CreateLeadInput = z.infer<typeof CreateLeadSchema>;
export type UpdateLeadInput = z.infer<typeof UpdateLeadSchema>;
