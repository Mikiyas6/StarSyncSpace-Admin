import { createGlobalStyle } from "styled-components";

const GlobalStyles = createGlobalStyle`
:root {

  /* Grey — cool, quiet neutrals (slate) */
    --color-grey-0: #ffffff;
    --color-grey-50: #f8fafc;
    --color-grey-100: #f1f5f9;
    --color-grey-200: #e2e8f0;
    --color-grey-300: #cbd5e1;
    --color-grey-400: #94a3b8;
    --color-grey-500: #64748b;
    --color-grey-600: #475569;
    --color-grey-700: #334155;
    --color-grey-800: #1e293b;
    --color-grey-900: #0f172a;

  --color-blue-100: #e0f2fe;
  --color-blue-700: #0369a1;
  /* Signal green — available */
  --color-green-100: #dcfce7;
  --color-green-700: #15803d;
  /* Amber — booked soon */
  --color-yellow-100: #fef3c7;
  --color-yellow-700: #b45309;
  /* Soft coral — in use / no-show */
  --color-coral-100: #ffe4df;
  --color-coral-700: #c23a28;
  --color-silver-100: #e2e8f0;
  --color-silver-700: #475569;
  --color-indigo-100: #f1f5f9;
  --color-indigo-700: #334155;

  /* Brand — StarSyncSpace slate ink */
  --color-brand-50: #f8fafc;
  --color-brand-100: #f1f5f9;
  --color-brand-200: #e2e8f0;
  --color-brand-500: #64748b;
  --color-brand-600: #0f172a;
  --color-brand-700: #1e293b;
  --color-brand-800: #334155;
  --color-brand-900: #0b1220;
  
  --color-red-100: #fee2e2;
  --color-red-700: #b91c1c;
  --color-red-800: #991b1b;
  
  --backdrop-color: rgba(255, 255, 255, 0.1);
  
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.04);
  --shadow-md: 0px 0.6rem 2.4rem rgba(0, 0, 0, 0.06);
  --shadow-lg: 0 2.4rem 3.2rem rgba(0, 0, 0, 0.12);

  --border-radius-tiny: 4px;
  --border-radius-sm: 8px;
  --border-radius-md: 12px;
  --border-radius-lg: 16px;

  
}

*,
*::before,
*::after {
  box-sizing: border-box;
  padding: 0;
  margin: 0;
}

html {
  font-size: 62.5%;
}

body {
  font-family: "Inter", sans-serif;
  color: var(--color-grey-700);

  min-height: 100vh;
  line-height: 1.5;
  font-size: 1.6rem;
  -webkit-font-smoothing: antialiased;
}

h1,
h2,
h3,
h4,
h5,
h6 {
  font-family: "Space Grotesk", sans-serif;
  font-weight: 600;
  letter-spacing: -0.02em;
}

input,
button,
textarea,
select {
  font: inherit;
  color: inherit;
}

button {
  cursor: pointer;
}

*:disabled {
  cursor: not-allowed;
}

select:disabled,
input:disabled {
  background-color: var(--color-grey-200);
  color: var(--color-grey-500);
}

input:focus,
button:focus,
textarea:focus,
select:focus {
  outline: 2px solid var(--color-brand-600);
  outline-offset: -1px;
}

/* Parent selector, finally 😃 */
button:has(svg) {
  line-height: 0;
}

a {
  color: inherit;
  text-decoration: none;
}

ul {
  list-style: none;
}

p,
h1,
h2,
h3,
h4,
h5,
h6 {
  overflow-wrap: break-word;
  hyphens: auto;
}

img {
  max-width: 100%;
}
`;

export default GlobalStyles;
