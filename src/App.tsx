import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/Layout";
import Index from "./pages/Index";
import Vault from "./pages/Vault";
import Workflows from "./pages/Workflows";
import Analysis from "./pages/Analysis";
import History from "./pages/History";
import NotFound from "./pages/NotFound";
import AuthPage from "./pages/Auth";
import { getCurrentUser } from "@/lib/auth";

const queryClient = new QueryClient();

const App = () => {
  const user = getCurrentUser();

  if (!user) {
    return <AuthPage />;
  }

  return (
    <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/vault" element={<Vault />} />
            <Route path="/workflows" element={<Workflows />} />
            <Route path="/analysis/:id" element={<Analysis />} />
            <Route path="/history" element={<History />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;
