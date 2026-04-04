import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/Layout";
import Landing from "@/pages/Landing";
import Dashboard from "@/pages/Dashboard";
import WritePaper from "@/pages/WritePaper";
import Outline from "@/pages/Outline";
import Revision from "@/pages/Revision";
import Plagiarism from "@/pages/Plagiarism";
import StemSolver from "@/pages/StemSolver";
import StudyAssistant from "@/pages/StudyAssistant";
import Documents from "@/pages/Documents";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function AppRoutes() {
  return (
    <Layout>
      <Switch>
        <Route path="/app" component={Dashboard} />
        <Route path="/write" component={WritePaper} />
        <Route path="/outline" component={Outline} />
        <Route path="/revision" component={Revision} />
        <Route path="/plagiarism" component={Plagiarism} />
        <Route path="/stem" component={StemSolver} />
        <Route path="/study" component={StudyAssistant} />
        <Route path="/documents" component={Documents} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route component={AppRoutes} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
