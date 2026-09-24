import { useSearchParams } from "react-router-dom";
import Select from "./Select";

function SortBy({ options }) {
  const [searchParams, setSearchParams] = useSearchParams();
  /* Falling back to the first option matters twice over: React warns
     about a null `value` on a controlled <select>, and the dropdown
     showed a blank while useBookings was already sorting by its own
     default — so the control disagreed with the table under it. */
  const currentSortBy = searchParams.get("sortBy") ?? options[0]?.value ?? "";

  function handleChange(e) {
    searchParams.set("sortBy", e.target.value);
    setSearchParams(searchParams);
  }

  if (!options?.length) return null;

  return (
    <Select options={options} value={currentSortBy} onChange={handleChange} />
  );
}

export default SortBy;
