import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import BranchStation from "@/pages/branch-station";
import Dashboard from "@/pages/dashboard";
import Control from "@/pages/control";

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/branch/:id" component={BranchStation} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/control" component={Control} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router hook={useHashLocation}>
          <AppRouter />
        </Router>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
