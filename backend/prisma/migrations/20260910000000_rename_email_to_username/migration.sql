ALTER TABLE "users" RENAME COLUMN "email" TO "username";
ALTER INDEX "users_email_key" RENAME TO "users_username_key";
UPDATE "users" SET "username" = 'leah' WHERE "username" = '6@gmail.com';
