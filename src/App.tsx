import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ChatProvider } from "./contexts/ChatContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthGate } from "./components/AuthGate";
import Chat from "./pages/Chat";
import Login from "./pages/Login";
import About from "./pages/About";
import SavedNotes from "./pages/SavedNotes";
import Calculators from "./pages/Calculators";
import MyPatient from "./pages/MyPatient";
import QbankMaker from "./pages/QbankMaker";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const Protected = ({ children }: { children: React.ReactNode }) => (
  <AuthGate>
    <ChatProvider>{children}</ChatProvider>
  </AuthGate>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<AuthGate invert><Login /></AuthGate>} />
            <Route path="/" element={<Protected><Chat /></Protected>} />
            <Route path="/chat" element={<Protected><Chat /></Protected>} />
            <Route path="/my-patient" element={<Protected><MyPatient /></Protected>} />
            <Route path="/qbank" element={<Protected><QbankMaker /></Protected>} />
            <Route path="/calculators" element={<Protected><Calculators /></Protected>} />
            <Route path="/saved" element={<Protected><SavedNotes /></Protected>} />
            <Route path="/about" element={<Protected><About /></Protected>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
