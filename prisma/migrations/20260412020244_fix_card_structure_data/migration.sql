-- Drop unique constraint on Card name (cards with same name should be allowed)
DROP INDEX IF EXISTS "Card_householdId_name_key";