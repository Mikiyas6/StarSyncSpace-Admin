import toast from "react-hot-toast";
import { signupApi } from "../../services/apiAuth";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useSignup() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { mutate: signUp, isLoading: isSigningUp } = useMutation({
    mutationFn: ({ fullName, email, password }) =>
      signupApi({ fullName, email, password }),
    onSuccess: (user) => {
      toast.success("Signup successful. Check your email for verification");
      console.log(user);
      queryClient.setQueryData(["user"], user.user);
    },
    onError: (err) => {
      toast.error("Error signing up");
    },
  });
  return { signUp, isSigningUp };
}
