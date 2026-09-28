import { revalidateClientSite } from "../../services/revalidateClientSite";

/* Tell the public site a menu item changed.

   The inventory screens have always done this after a movement; editing
   the menu itself never did, so a dish taken off it sat on the room
   pages until their own five minute floor expired. An open page now
   corrects itself within half a minute on its own (see the Client's
   use-live-menu), but somebody arriving fresh gets the statically
   generated page — and that is the one this drops.

   Best-effort by design: if the site is unreachable its own window
   still catches up. The path given is immaterial, because the revalidate
   route clears the menu tag and every room page whatever it is handed.
 */
export function refreshPublicMenu() {
  revalidateClientSite(["/rooms"]);
}
