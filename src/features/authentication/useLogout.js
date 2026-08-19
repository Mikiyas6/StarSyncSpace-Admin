import {
  QueryErrorResetBoundary,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { logoutApi } from "../../services/apiAuth";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

export function useLogout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { mutate: logout, isLoading } = useMutation({
    mutationFn: logoutApi,
    onSuccess: () => {
      toast.success("Logged out successfully");
      queryClient.removeQueries();
      navigate("/login", { replace: true });
    },
    onError: (error) => {
      toast.error("Failed to logout");
      console.error("Error logging out:", error.message);
    },
  });
  return { logout, isLoading };
}
