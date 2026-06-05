import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ChatProvider } from "./contexts/ChatContext";
import Chat from "./pages/Chat";
import About from "./pages/About";
import SavedNotes from "./pages/SavedNotes";
import Calculators from "./pages/Calculators";
import MyPatient from "./pages/MyPatient";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ChatProvider>
          <Routes>
            <Route path="/" element={<Chat />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/about" element={<About />} />
            <Route path="/saved" element={<SavedNotes />} />
            <Route path="/calculators" element={<Calculators />} />
            <Route path="/my-patient" element={<MyPatient />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </ChatProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
