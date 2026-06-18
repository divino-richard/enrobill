import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import { useSessionSync } from "./features/auth/hooks";

// Top-level app: keeps the session in sync, then renders the router.
export function App() {
  useSessionSync();
  return <RouterProvider router={router} />;
}
