import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import {
  getTeam,
  setTeamMemberActive,
  setTeamMemberRole,
} from "../../services/apiTeam";

export function useTeam() {
  const { isLoading, data: team, error } = useQuery({
    queryKey: ["team"],
    queryFn: getTeam,
  });

  return { isLoading, team: team ?? [], error };
}

export function useSetRole() {
  const queryClient = useQueryClient();

  const { mutate: setRole, isLoading: isSettingRole } = useMutation({
    mutationFn: ({ id, role }) => setTeamMemberRole(id, role),
    onSuccess: (admin) => {
      toast.success(
        admin.role === "admin"
          ? `${nameOf(admin)} is now an admin`
          : `${nameOf(admin)} is now staff`,
      );
      queryClient.invalidateQueries({ queryKey: ["team"] });
      /* The signed-in person may have changed their OWN role, in which
         case every gated control on screen is now wrong until this is
         refetched. */
      queryClient.invalidateQueries({ queryKey: ["admin-role"] });
    },
    onError: (error) => toast.error(error.message),
  });

  return { setRole, isSettingRole };
}

export function useSetActive() {
  const queryClient = useQueryClient();

  const { mutate: setActive, isLoading: isSettingActive } = useMutation({
    mutationFn: ({ id, isActive }) => setTeamMemberActive(id, isActive),
    onSuccess: (admin) => {
      toast.success(
        admin.is_active
          ? `${nameOf(admin)} can sign in again`
          : `${nameOf(admin)}'s access has been revoked`,
      );
      queryClient.invalidateQueries({ queryKey: ["team"] });
      queryClient.invalidateQueries({ queryKey: ["admin-role"] });
    },
    onError: (error) => toast.error(error.message),
  });

  return { setActive, isSettingActive };
}

/* full_name is optional and email can be missing on a row created before
   the trigger existed, so a toast has to cope with having neither rather
   than announcing that "undefined is now an admin". */
function nameOf(admin) {
  return admin?.full_name || admin?.email || "This person";
}
