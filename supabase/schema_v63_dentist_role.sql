-- v63: Add dentist to user_role enum to match application role selectors
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'dentist';
