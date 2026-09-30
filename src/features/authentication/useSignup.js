import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { createTeamMember } from "../../services/apiCreateTeamMember";

/* Create a login for a colleague.

   Three things this deliberately does NOT do any more, each of which was
   a bug:

     · it does not write the new account into the ["user"] cache. That
       line told the whole dashboard the signed-in person was now the
       person who had just been hired.

     · it does not navigate or otherwise disturb the session. Creating
       somebody's login is an edit to a list, not a sign-in.

     · it does not replace the error with "Error signing up". The real
       message is the useful part: an address already taken and a
       password Supabase refused need different actions from the admin,
       and one sentence for both makes the form look broken.
*/
export function useSignup() {
  const queryClient = useQueryClient();

  const { mutate: signUp, isLoading: isSigningUp } = useMutation({
    mutationFn: createTeamMember,
    onSuccess: (result) => {
      const who = result?.member?.full_name || result?.member?.email || "They";
      const asRole = result?.role === "admin" ? "an admin" : "staff";

      toast.success(
        result?.canSignInNow
          ? `${who} can sign in now, as ${asRole}.`
          : `${who} has been added as ${asRole}.`,
      );

      /* Two separate things can be worth saying after a success: the
         role could not be applied, or the account needs to confirm its
         email first. Both leave the admin with something to do, so
         neither is allowed to hide behind the success toast. */
      if (result?.warning) toast(result.warning, { duration: 8000, icon: "!" });

      // The point of the page is the list; it now has a new row in it.
      queryClient.invalidateQueries({ queryKey: ["team"] });
    },
    onError: (error) => toast.error(error.message),
  });

  return { signUp, isSigningUp };
}
