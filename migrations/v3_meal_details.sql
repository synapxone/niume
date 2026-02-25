-- ============================================================
-- v3_meal_details.sql
-- Adds quantity and unit columns to the meals table for better 
-- granular tracking of food portions.
-- ============================================================

ALTER TABLE meals 
ADD COLUMN IF NOT EXISTS quantity numeric(8,2),
ADD COLUMN IF NOT EXISTS unit text;
