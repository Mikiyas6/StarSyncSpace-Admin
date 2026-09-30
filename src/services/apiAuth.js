import supabase, { supabaseUrl } from "./supabase";

/* signupApi was here, and it is gone on purpose.

   It called supabase.auth.signUp from the browser, which signs the NEW
   account in — so "add a member of staff" signed the admin out of their
   own session and into the new one. It also produced an account that
   could not sign in, because this project requires email confirmation.

   Creating a login now happens on a server, in
   services/apiCreateTeamMember.js → the Client site's
   POST /api/admin/team. Nothing in a browser should call signUp again. */

export async function loginApi({ email, password }) {
  let { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) {
    console.error("Error logging in:", error.message);
    throw new Error(error.message);
  }
  return data;
}

export async function getCurrentUser() {
  // Get the current user from the session from the server
  const { data: session } = await supabase.auth.getSession();

  if (!session.session) {
    return null;
  }
  const { data, error } = await supabase.auth.getUser();
  if (error) throw new Error(error.message);
  return data?.user;
}

export async function logoutApi() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error("Error logging out:", error.message);
    throw new Error(error.message);
  }
}

export async function updateCurrentUser({ password, fullName, avatar }) {
  // 1. Update password OR fullName
  let updateData;
  if (password) {
    updateData = { password };
  }
  if (fullName) {
    updateData = { data: { fullName } };
  }
  const { data, error } = await supabase.auth.updateUser(updateData);

  if (error) throw new Error(error.message);

  if (!avatar) return data;

  // 2. Upload the Avatar Image

  const fileName = `avatar-${data.user.id}-${Math.random()}`;
  const { error: storageError } = await supabase.storage
    .from("avatars")
    .upload(fileName, avatar);

  if (storageError) {
    throw new Error(error.message);
  }

  // 3. Update Avatar in the User

  const { data: updatedUser, error: userError } =
    await supabase.auth.updateUser({
      data: {
        avatar: `${supabaseUrl}/storage/v1/object/public/avatars/${fileName}`,
      },
    });

  if (userError) {
    throw new Error(userError.message);
  }
  return updatedUser;
}
