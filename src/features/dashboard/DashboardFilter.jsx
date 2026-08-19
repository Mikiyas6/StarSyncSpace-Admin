import { useSearchParams } from "react-router-dom";
import { format, subDays } from "date-fns";
import styled, { css } from "styled-components";
import Filter from "../../ui/Filter";

const FilterGroup = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.8rem;
`;

const ChipButton = styled.button.attrs({ type: "button" })`
  background-color: var(--color-grey-0);
  border: 1px solid var(--color-grey-100);
  box-shadow: var(--shadow-sm);
  border-radius: var(--border-radius-sm);
  font-weight: 500;
  font-size: 1.4rem;
  padding: 0.6rem 1.1rem;
  transition: all 0.3s;

  ${(props) =>
    props.$active &&
    css`
      background-color: var(--color-brand-600);
      color: var(--color-brand-50);
      border-color: var(--color-brand-600);
    `}

  &:hover:not(:disabled) {
    background-color: var(--color-brand-600);
    color: var(--color-brand-50);
    border-color: var(--color-brand-600);
  }
`;

const DateRangeInputs = styled.div`
  display: flex;
  align-items: center;
  gap: 0.6rem;
  border: 1px solid var(--color-grey-100);
  background-color: var(--color-grey-0);
  box-shadow: var(--shadow-sm);
  border-radius: var(--border-radius-sm);
  padding: 0.4rem 1rem;
`;

const DateInput = styled.input.attrs({ type: "date" })`
  border: none;
  background: transparent;
  font-family: inherit;
  font-size: 1.3rem;
  font-weight: 500;
  color: var(--color-grey-700);

  &:focus {
    outline: none;
  }
`;

const Dash = styled.span`
  font-size: 1.4rem;
  color: var(--color-grey-400);
`;

function DashboardFilter() {
  const [searchParams, setSearchParams] = useSearchParams();

  const isCustom =
    searchParams.get("last") === "custom" ||
    (searchParams.has("from") && searchParams.has("to"));

  const fromValue = searchParams.get("from") ?? "";
  const toValue = searchParams.get("to") ?? "";

  function handleCustomClick() {
    if (isCustom) return;
    const params = new URLSearchParams(searchParams);
    params.set("last", "custom");
    params.set("from", format(subDays(new Date(), 6), "yyyy-MM-dd"));
    params.set("to", format(new Date(), "yyyy-MM-dd"));
    setSearchParams(params);
  }

  function handleDateChange(field, value) {
    const params = new URLSearchParams(searchParams);

    if (value) {
      params.set(field, value);
      if (params.get("from") && params.get("to")) params.delete("last");
    } else {
      params.delete("from");
      params.delete("to");
      params.set("last", "7");
    }

    setSearchParams(params);
  }

  return (
    <FilterGroup>
      <Filter
        filterField="last"
        activeValue={isCustom ? "custom" : undefined}
        clearKeys={["from", "to"]}
        options={[
          { value: "7", label: "7 days" },
          { value: "30", label: "30 days" },
          { value: "90", label: "90 days" },
          { value: "365", label: "Year" },
        ]}
      />
      <ChipButton
        onClick={handleCustomClick}
        $active={isCustom}
        disabled={isCustom}
      >
        Custom
      </ChipButton>

      {isCustom && (
        <DateRangeInputs>
          <DateInput
            value={fromValue}
            onChange={(e) => handleDateChange("from", e.target.value)}
            aria-label="From date"
          />
          <Dash>&mdash;</Dash>
          <DateInput
            value={toValue}
            onChange={(e) => handleDateChange("to", e.target.value)}
            aria-label="To date"
          />
        </DateRangeInputs>
      )}
    </FilterGroup>
  );
}

export default DashboardFilter;