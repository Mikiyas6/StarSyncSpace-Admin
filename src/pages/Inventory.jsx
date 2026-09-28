import InventoryPage from "../features/inventory/InventoryPage";

/* Deliberately NOT wrapped in RequireAdmin.

   Selling a snack and recording one removed is desk work — it is most of
   what this page is for — so staff need it. What they do not get is the
   restock, recount, stock-target and add-item controls, which are gated
   inside the page itself (and refused by row-level security regardless of
   what the UI shows). */
function Inventory() {
  return <InventoryPage />;
}

export default Inventory;
