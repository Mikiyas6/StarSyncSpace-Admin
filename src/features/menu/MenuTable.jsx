import { useMemo, useState } from "react";
import styled from "styled-components";
import MenuRow from "./MenuRow";
import { useMenuOverview } from "./useMenuOverview";
import Table from "../../ui/Table";
import Menus from "../../ui/Menus";
import Empty from "../../ui/Empty";
import Spinner from "../../ui/Spinner";
import { Search, SlidersHorizontal } from "lucide-react";
import Select from "../../ui/Select";

const Toolbar = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 1.2rem;
  align-items: center;
  margin-bottom: 1.6rem;
`;

const SearchBox = styled.div`
  position: relative;
  flex: 1;
  min-width: 24rem;

  svg {
    position: absolute;
    left: 1.2rem;
    top: 50%;
    transform: translateY(-50%);
    width: 1.7rem;
    height: 1.7rem;
    color: var(--color-grey-400);
    pointer-events: none;
  }

  input {
    width: 100%;
    border: 1px solid var(--color-grey-300);
    background-color: var(--color-grey-0);
    border-radius: var(--border-radius-sm);
    padding: 0.8rem 1.2rem 0.8rem 3.6rem;
    font-size: 1.4rem;

    &:focus {
      outline: 2px solid var(--color-brand-600);
      outline-offset: -1px;
    }
  }
`;

const Count = styled.p`
  font-size: 1.2rem;
  color: var(--color-grey-500);
  margin-left: auto;
`;

function MenuTable({ categoryId }) {
  const { data: overview, isLoading } = useMenuOverview();
  const [query, setQuery] = useState("");
  const [availability, setAvailability] = useState("all");

  const sectionNames = useMemo(() => {
    const map = new Map();
    (overview?.sections ?? []).forEach((s) => map.set(s.id, s.name));
    return map;
  }, [overview?.sections]);

  const filteredItems = useMemo(() => {
    let items = overview?.items ?? [];

    if (categoryId) {
      const sectionIds = new Set(
        (overview?.sections ?? [])
          .filter((s) => s.category_id === categoryId)
          .map((s) => s.id)
      );
      items = items.filter((i) => sectionIds.has(i.section_id));
    }

    const q = query.trim().toLowerCase();
    if (q) {
      items = items.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          (i.description ?? "").toLowerCase().includes(q)
      );
    }

    if (availability === "available")
      items = items.filter((i) => i.is_available);
    if (availability === "unavailable")
      items = items.filter((i) => !i.is_available);

    return items;
  }, [overview, categoryId, query, availability]);

  if (isLoading) return <Spinner />;
  if (!overview) return null;

  return (
    <div>
      <Toolbar>
        <SearchBox>
          <Search aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search items by name or description…"
            aria-label="Search menu items"
          />
        </SearchBox>
        <Select
          value={availability}
          onChange={(e) => setAvailability(e.target.value)}
          options={[
            { value: "all", label: "All items" },
            { value: "available", label: "Available only" },
            { value: "unavailable", label: "Sold out only" },
          ]}
          aria-label="Filter by availability"
        />
        <Count>
          <SlidersHorizontal
            style={{ width: "1.4rem", height: "1.4rem", verticalAlign: "-2px" }}
            aria-hidden
          />{" "}
          {filteredItems.length} item{filteredItems.length === 1 ? "" : "s"}
        </Count>
      </Toolbar>

      {filteredItems.length === 0 ? (
        <Empty resourceName="menu items" />
      ) : (
        <Menus>
          <Table columns="5.6rem 2.2fr 1.2fr 1fr 1.5fr 1.2fr 1.5fr">
            <Table.Header>
              <div></div>
              <div>Item</div>
              <div>Section</div>
              <div>Price</div>
              <div>Status</div>
              <div>Updated</div>
              <div></div>
            </Table.Header>
            <Table.Body
              data={filteredItems}
              render={(item) => (
                <MenuRow
                  key={item.id}
                  item={item}
                  sectionName={sectionNames.get(item.section_id) ?? "—"}
                />
              )}
            />
          </Table>
        </Menus>
      )}
    </div>
  );
}

export default MenuTable;