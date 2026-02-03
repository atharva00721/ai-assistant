-- Add todoist_token column to users table
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'todoist_token'
    ) THEN
        ALTER TABLE "users" ADD COLUMN "todoist_token" text;
    END IF;
END $$;
