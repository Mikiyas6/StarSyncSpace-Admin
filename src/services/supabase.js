import { createClient } from "@supabase/supabase-js";
// Supabase Project URL
export const supabaseUrl = "https://tyehehkndsmfxprggqxe.supabase.co";
// Supabase Project Anon Key
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5ZWhlaGtuZHNtZnhwcmdncXhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzczODQ0OTMsImV4cCI6MjA1Mjk2MDQ5M30.v4TiDoE2g8cZfOKCq3SE3xsDVnE__7WEaTVjxb1w9oM";
const supabase = createClient(supabaseUrl, supabaseKey);
/*   

We create a supabase client for interacting with our database. Interactions include:
    
    - Make database queries
          supabase.from("table_name")  // Access a table
            .select()                  // Read data
            .insert()                  // Create records
            .update()                  // Update records
            .delete()                  // Delete records
    - Manage file storage
          supabase.storage.from("bucket_name")
            .upload()
            .download()
    - Handle authentication
          supabase.auth
            .signUp()
            .signIn()
            .signOut()
   */
export default supabase;
