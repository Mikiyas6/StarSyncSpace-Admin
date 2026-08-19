import React from "react"; // For JSX compilation
import ReactDOM from "react-dom/client"; // For rendering React components and DOM manipulations
import App from "./App.jsx"; // Import the main App component
import { ErrorBoundary } from "react-error-boundary";
import ErrorFallback from "./ui/ErrorFallback.jsx";

// Get the container from the HTML file. It is the div with the id "root" and where our React app will be rendered or live
const container = document.getElementById("root");

// Create a root object by passing the container element to ReactDOM.createRoot that will manage the React app
const root = ReactDOM.createRoot(container);

// Passing the entire Application to the root object to render it so that it will be displayed in the container element or live in the DOM
root.render(
  <React.StrictMode>
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={() => window.location.replace("/")}
    >
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
